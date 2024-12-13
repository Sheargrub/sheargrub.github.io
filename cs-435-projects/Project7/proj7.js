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
var sourceMinos;
var draggableMinos;
var lowerLine;
var upperLine;

var bgGridNear;
var bgGridFar;

// state information
var dragActive;
var clickIndex;
var prevX;
var prevY;

const DELETION_Y = 100;
const FRAMETIME_MS = 16.7;

// bx, by: grid positions of blocks in the mino; to be multiplied by bWidth. Pass in arrays of length 4
class ProtoMino {
    
    constructor(color, bWidth, x, y, bx, by) {

        if (bx.length != by.length) throw new Error("Mismatched mino coordinate inputs");
        this.centerIndex = -1; // Block that is currently acting as the center of the mino

        this.blocks;

        this.color = color;
        this.bWidth = bWidth;
        this.x = x;
        this.y = y;
        this.bx = bx;
        this.by = by;

    }

    init() {
        this.blocks = [];
        for (var i = 0; i < this.bx.length; i++) {
            this.blocks.push(new Block(this.color, this.x, this.y, this.bx[i], this.by[i], this.bWidth, i));
            if (this.bx[i] == 0 && this.by[i] == 0) this.centerIndex = i;
            this.blocks[i].init();
        }
    };

    // Returns the index of the block for which collision was detected.
    blockMeeting(x, y) {
        for (var i = 0; i < this.blocks.length; i++) {
            if (this.blocks[i].isInside(x, y)) {
                return i;
            }
        }
        return null;
    };

    setPosition(x, y) {
        this.x = x;
        this.y = y;
        for (var i = 0; i < this.blocks.length; i++) {
            this.blocks[i].parentX = this.x;
            this.blocks[i].parentY = this.y;
        }
    };

    shiftPosition(dx, dy) {
        this.setPosition(this.x + dx, this.y + dy);
    };

    // Returns true if any part of the block is below y.
    isBelow(y) {
        for (var i = 0; i < this.blocks.length; i++) {
            if (this.blocks[i].isBelow(y)) {
                return true;
            }
        }
        return false; 
    }

    // Sets the center block
    setCenter(idx) {
        var xAdj = this.blocks[idx].offsetX;
        var yAdj = this.blocks[idx].offsetY;
        this.shiftPosition(xAdj, yAdj);

        xAdj = -xAdj;
        yAdj = -yAdj;
        for (var i = 0; i < this.blocks.length; i++) {
            this.blocks[i].shiftOffset(xAdj, yAdj);
        }

        this.centerIndex = idx;
    };

    // Rotates about the current center block
    rotate(clockwise = false) {
        if (clockwise) {
            for (var i = 0; i < this.blocks.length; i++) {
                this.blocks[i].rotateClockwise();
            }
        }
        else {
            for (var i = 0; i < this.blocks.length; i++) {
                this.blocks[i].rotateCounterClockwise();
            }
        }
    };

    draw() {
        for (var i = 0; i < this.blocks.length; i++) {
            this.blocks[i].draw();
        }
    };

    clone() {
        return new ProtoMino(this.color, this.bWidth, this.x, this.y, this.bx, this.by);
    }
}

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
        console.log(this.color);
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

    canvas.addEventListener("mousedown", function(event){
        if (event.button!=0) return; // left button only
        var x = event.pageX - canvas.offsetLeft;
        var y = event.pageY - canvas.offsetTop;
        y=canvas.height-y;

        prevX=x;
        prevY=y;
        
        dragActive = false;

        // First, see if one of the draggable minos is being clicked.
        // (Iterate in reverse order to account for depth)
        for (var i = draggableMinos.length-1; i >= 0; i--) {
            var blockIndex = draggableMinos[i].blockMeeting(x, y);
            if (blockIndex != null) {
                dragActive = true;
                clickIndex = draggableMinos.length-1;

                // Minimize mino depth by moving it to the end of the list
                var temp = draggableMinos[i]
                for (var j = i; j < draggableMinos.length-1; j++) {
                    draggableMinos[j] = draggableMinos[j+1];
                }
                draggableMinos[clickIndex] = temp;

                if (event.shiftKey) {  // with shift key, rotate counter-clockwise
                    draggableMinos[clickIndex].setCenter(blockIndex);
                    draggableMinos[clickIndex].rotate();
                    // Check for deletion
                    if (draggableMinos[clickIndex].isBelow(DELETION_Y)) {
                        dragActive = false;
                        draggableMinos.splice(clickIndex, 1);
                    }
                }

                return;
            }
        }

        // If not, check if it's time to duplicate one of the source minos.
        for (var i = 0; i < sourceMinos.length; i++) {
            if (sourceMinos[i].blockMeeting(x, y) != null) {
                dragActive = true;
                clickIndex = draggableMinos.length;
                draggableMinos.push(sourceMinos[i].clone()); // duplicate mino
                draggableMinos[clickIndex].init();
                
                return;
            }
        }

    });
    
    canvas.addEventListener("mouseup", function(event){
        dragActive = false;
    });

    canvas.addEventListener("mousemove", function(event){
        if (dragActive) {
            var x = event.pageX - canvas.offsetLeft;
            var y = event.pageY - canvas.offsetTop;
            y = canvas.height - y;
            draggableMinos[clickIndex].shiftPosition(x-prevX, y-prevY);

            // Check for deletion
            if (draggableMinos[clickIndex].isBelow(DELETION_Y)) {
                dragActive = false;
                draggableMinos.splice(clickIndex, 1);
            }

        }
        prevX=x;
        prevY=y;
    });

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0, 0, 0.25, 1.0 );

    //
    //  Load shaders and initialize attribute buffers
    //
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // Initial State
    sourceMinos = [
        new ProtoMino(vec4(0.5, 0.0, 1.0, 1.0), 30, 60, 540,
            [0, 1, 0, -1],
            [0, 0, -1, 0]
        ), // T
        new ProtoMino(vec4(0.0, 1.0, 1.0, 1.0), 30, 150, 570,
            [0, 0, 0, 0],
            [0, -1, -2, -3]
        ), // I
        new ProtoMino(vec4(1.0, 1.0, 0.0, 1.0), 30, 210, 540,
            [0, 0, 1, 1],
            [0, -1, 0, -1]
        ), // O
        new ProtoMino(vec4(0.0, 1.0, 0.0, 1.0), 30, 330, 540,
            [0, -1, 0, 1],
            [0, -1, -1, 0]
        ), // S
        new ProtoMino(vec4(1.0, 0.0, 0.0, 1.0), 30, 450, 540,
            [0, 1, 0, -1],
            [0, -1, -1, 0]
        ), // T
        new ProtoMino(vec4(1.0, 0.5, 0.0, 1.0), 30, 570, 555,
            [0, 0, 0, -1],
            [0, -1, -2, -2]
        ), // J
        new ProtoMino(vec4(0.0, 0.0, 1.0, 1.0), 30, 630, 555,
            [0, 0, 0, 1],
            [0, -1, -2, -2]
        ), // L
    ]
    for (var i = 0; i < sourceMinos.length; i++) {
        sourceMinos[i].init();
        sourceMinos[i].shiftPosition(30, -15); // small shared offset
    }

    draggableMinos = [];

    upperLine = new Line(vec4(1.0, 1.0, 1.0, 1.0), 20, 450, 780, 450);
    upperLine.init();
    lowerLine = new Line(vec4(1.0, 1.0, 1.0, 1.0), 20, 100, 780, 100);
    lowerLine.init();

    bgGridFar = new BackgroundGrid(vec4(0.2, 0.0, 0.4, 1.0), 30, 28, 120, 100);
    bgGridFar.init();
    bgGridNear = new BackgroundGrid(vec4(0.1, 0.4, 0.5, 1.0), 18, 14, 85, 55);
    bgGridNear.init();

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
    console.log("updated");
    bgGridNear.update(delta_ms);
    bgGridFar.update(delta_ms);

    render();
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    bgGridFar.draw();
    bgGridNear.draw();
    upperLine.draw();
    lowerLine.draw();
    for (var i = 0; i < sourceMinos.length; i++) {
        sourceMinos[i].draw();
    }
    for (var i = 0; i < draggableMinos.length; i++) {
        draggableMinos[i].draw();
    }
}
