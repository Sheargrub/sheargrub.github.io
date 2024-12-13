"use strict"

/*
    CS 435, Project 7
    Ian Minor
    A web game about dodging bullets.
*/

var canvas;
var gl;

var projection; // projection matrix uniform shader variable location
var transformation; // projection matrix uniform shader variable location
var vPosition;  // location of attrubute variables
// var vColor;
var uColor;   // location of uniform variable 

// objects
var bgGridNear;
var bgGridFar;

var player;
var followLine;

// state information
var mouseInField = false;
var mouseX = 0;
var mouseY = 0;
var clickPressed = false;
var clickHeld = false;
var focusPressed = false;
var focusHeld = false;

const FRAMETIME_MS = 16.7;

const MAX_PLAYER_SPEED = 1200 * FRAMETIME_MS/1000;
const MAX_FOCUS_SPEED = 300 * FRAMETIME_MS/1000;

class Block {
    constructor(color, parentX, parentY, bx, by, bWidth, idx) {

        this.color = color;
        this.bWidth = bWidth;
        this.parentX = parentX;
        this.parentY = parentY;
        this.offsetX = bx * bWidth;
        this.offsetY = by * bWidth;
        this.idx = idx;

        this.points = [
            vec2(0, 0),
            vec2(0, bWidth),
            vec2(bWidth, bWidth),
            vec2(bWidth, 0),
        ];

    }

    // Since this is an axis-aligned square, inside-ness is simple to check
    isInside(x, y) {
        var blockX = this.parentX + this.offsetX;
        var blockY = this.parentY + this.offsetY;
        return blockX <= x && x <= (blockX + this.bWidth) && blockY <= y && y <= (blockY + this.bWidth);
    };

    // Returns true if any part of the block is below y.
    isBelow(y) {
        var blockY = this.parentY + this.offsetY;
        return blockY < y;
    };

    shiftOffset(x, y) {
        this.offsetX += x;
        this.offsetY += y;
    };

    rotateClockwise() {
        var temp = -this.offsetX;
        this.offsetX = this.offsetY;
        this.offsetY = temp;
    };

    rotateCounterClockwise() {
        var temp = this.offsetX;
        this.offsetX = -this.offsetY;
        this.offsetY = temp;
    };

    init() {
        this.vBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.points), gl.STATIC_DRAW);
    };

    draw() {
        // Remember, root of defined coordinates is hard-set to (0, 0)
        var tm = translate(this.parentX + this.offsetX, this.parentY + this.offsetY, 0.0);
        tm = mult(tm, rotate(0, vec3(0, 0, 1))); // rotates by 0 degrees
        tm = mult(tm, translate(-this.points[0][0], -this.points[0][1], 0.0));
        gl.uniformMatrix4fv(transformation, gl.FALSE, flatten(tm));

        // send the color as a uniform variable
        gl.uniform4fv(uColor, flatten(this.color));

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    };
}

class Player {
    constructor(color, x, y) {

        this.color = color;
        this.x = x;
        this.y = y;

        this.points = [
            vec2(-25, -25),
            vec2(-25, 25),
            vec2(25, 25),
            vec2(25, -25),
        ];

    }

    init() {
        this.vBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.points), gl.STATIC_DRAW);
    };

    updateWithMouse() {
        var speed = MAX_PLAYER_SPEED;
        if (focusHeld) speed = MAX_FOCUS_SPEED;

        var mouseDistX = mouseX - this.x;
        var mouseDistY = mouseY - this.y;

        if (mouseDistX*mouseDistX + mouseDistY*mouseDistY <= speed*speed) {
            this.x = mouseX;
            this.y = mouseY;
        } else {
            var dist = Math.sqrt(mouseDistX*mouseDistX + mouseDistY*mouseDistY)
            this.x += speed*mouseDistX/dist;
            this.y += speed*mouseDistY/dist;
        }
    }

    draw() {
        // Remember, root of defined coordinates is hard-set to (0, 0)
        var tm = translate(this.x, this.y, 0.0);
        gl.uniformMatrix4fv(transformation, gl.FALSE, flatten(tm));

        // send the color as a uniform variable
        gl.uniform4fv(uColor, flatten(this.color));

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    };
}


class Line {
    constructor(color, x0, y0, x1, y1) {

        this.color = color;
        this.points = [
            vec2(x0, y0),
            vec2(x1, y1),
        ];

        this.init = function () {
            this.vBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, flatten(this.points), gl.STATIC_DRAW);
        };

        this.draw = function () {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, flatten(this.points), gl.STATIC_DRAW);

            var tm = translate(0.0, 0.0, 0.0);
            gl.uniformMatrix4fv(transformation, gl.FALSE, flatten(tm));

            // send the color as a uniform variable
            gl.uniform4fv(uColor, flatten(this.color));

            gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
            gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(vPosition);

            gl.drawArrays(gl.LINES, 0, 2);
        };

    }
}

class BackgroundGrid {
    constructor(color, hspeed, vspeed, hspacing, vspacing) {
        this.color = color;
        this.hsp = hspeed;
        this.vsp = vspeed;
        this.maxX = canvas.width + hspacing - (canvas.width % hspacing);
        this.maxY = canvas.height + vspacing - (canvas.height % vspacing);
        
        this.horizontal = [];
        this.vertical = [];

        for (var i = 0; i < this.maxY; i += vspacing) {
            this.horizontal.push(vec2(0, i));
            this.horizontal.push(vec2(canvas.width, i));
        }

        for (var i = 0; i < this.maxX; i += hspacing) {
            this.vertical.push(vec2(i, 0));
            this.vertical.push(vec2(i, canvas.height));
        }
        
        this.numPoints = this.horizontal.length + this.vertical.length;
    }

    init() {
        var points = this.horizontal.concat(this.vertical)
        this.vBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    }

    update(delta_ms) {
        for (var i = 0; i < this.horizontal.length; i++) {
            this.horizontal[i][1] += this.vsp*delta_ms/1000.0;
            if (this.horizontal[i][1] > this.maxY) this.horizontal[i][1] -= this.maxY;
            else if (this.horizontal[i][1] < 0) this.horizontal[i][1] += this.maxY;
        }
        for (var i = 0; i < this.vertical.length; i++) {
            this.vertical[i][0] += this.hsp*delta_ms/1000.0;
            if (this.vertical[i][0] >this.maxX) this.vertical[i][0] -= this.maxX;
            else if (this.vertical[i][0] < 0) this.vertical[i][0] += this.maxX;
        }
    }

    draw() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        var points = this.horizontal.concat(this.vertical);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

        var tm = translate(0.0, 0.0, 0.0);
        gl.uniformMatrix4fv(transformation, gl.FALSE, flatten(tm));

        // send the color as a uniform variable
        gl.uniform4fv(uColor, flatten(this.color));

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.drawArrays(gl.LINES, 0, this.numPoints);
    };
}

window.onload = function initialize() {
    canvas = document.getElementById("gl-canvas");

    gl = canvas.getContext('webgl2');
    if (!gl) alert("WebGL 2.0 isn't available");

    canvas.addEventListener("mouseover", function(event){
        mouseInField = true;
    });

    canvas.addEventListener("mouseout", function(event){
        mouseInField = false;
    });

    canvas.addEventListener("mousedown", function(event){
        clickPressed = true;
        clickHeld = true;
    });
    
    canvas.addEventListener("mouseup", function(event){
        clickPressed = false;
        clickHeld = false;
    });

    canvas.addEventListener("mousemove", function(event){
        mouseX = event.pageX - canvas.offsetLeft;
        mouseY = canvas.height - (event.pageY - canvas.offsetTop);
    });

    document.addEventListener("keydown", function(event){
        if (event.key == "Shift") {
            focusPressed = !focusHeld;
            focusHeld = true;
        }
    });

    document.addEventListener("keyup", function(event){
        if (event.key == "Shift") {
            focusPressed = false;
            focusHeld = false;
        }
    });

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0, 0, 0.25, 1.0 );

    //
    //  Load shaders and initialize attribute buffers
    //
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    bgGridFar = new BackgroundGrid(vec4(0.2, 0.0, 0.4, 1.0), 30, 28, 120, 100);
    bgGridFar.init();
    bgGridNear = new BackgroundGrid(vec4(0.1, 0.4, 0.5, 1.0), 18, 14, 85, 55);
    bgGridNear.init();

    player = new Player(vec4(0.8, 0.0, 0.0, 1.0), 250, 500);
    player.init();

    followLine = new Line(vec4(1.0, 1.0, 1.0, 0.5), canvas.width/2, canvas.height/2, canvas.width/2, canvas.height/2);
    followLine.init();

    projection = gl.getUniformLocation( program, "projection" );
    var pm = ortho( 0.0, canvas.width, 0.0, canvas.height, -1.0, 1.0 );
    gl.uniformMatrix4fv( projection, gl.FALSE, flatten(pm) );

    transformation = gl.getUniformLocation( program, "transformation" );

    uColor = gl.getUniformLocation( program, "uColor" );

    vPosition = gl.getAttribLocation( program, "aPosition" );
    //vColor = gl.getAttribLocation( program, "aColor" );

    setInterval(function () {update(FRAMETIME_MS)}, FRAMETIME_MS);
}

function update(delta_ms) {
    bgGridNear.update(delta_ms);
    bgGridFar.update(delta_ms);

    if (mouseInField) {
        player.updateWithMouse();
        followLine.points[0] = vec2(player.x, player.y);
        followLine.points[1] = vec2(mouseX, mouseY);
    }

    clickPressed = false;
    focusPressed = false;

    render();
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    bgGridFar.draw();
    bgGridNear.draw();
    player.draw();
    if (mouseInField) followLine.draw();
}
