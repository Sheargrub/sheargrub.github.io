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
var hurtboxOuter;
var hurtboxInner;
var followLine;

var bulletRings;
var ringFactories;

// state information
var mouseInField = false;
var mouseX = 0;
var mouseY = 0;
var clickPressed = false;
var clickHeld = false;
var focusPressed = false;
var focusHeld = false;

var playerHit = false;
var timerStart = 0;
var phase = 0;

const FRAMETIME_MS = 16.7;

const MAX_PLAYER_SPEED = 1200 * FRAMETIME_MS/1000;
const MAX_FOCUS_SPEED = 300 * FRAMETIME_MS/1000;
const HURTBOX_RADIUS = 4

const PHASE_TIMINGS = [5, 15, 30, 40, 50, 60, 120];
const PHASE_TEXT = [
    "Welcome aboard!",
    "Starting off simple.",
    "Speed up!",
    "Variance up!",
    "Density up!",
    "Frequency up!",
    "Here's where the real game begins~",
]
const BEHAVIOR_TEXT = [
    "Speed",
    "Variance",
    "Density",
    "Frequency"
]

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

class Circle {
    constructor(color, x, y, radius) {

        this.color = color
        this.x = x;
        this.y = y;
        this.radius = radius;

        this.points = [
            vec2(0, 0),
            vec2(1, 0),
            vec2(Math.sqrt(3)/2, 1/2),
            vec2(1/Math.sqrt(2), 1/Math.sqrt(2)),
            vec2(1/2, Math.sqrt(3)/2),
            vec2(0, 1),
            vec2(-1/2, Math.sqrt(3)/2),
            vec2(-1/Math.sqrt(2), 1/Math.sqrt(2)),
            vec2(-Math.sqrt(3)/2, 1/2),
            vec2(-1, 0),
            vec2(-Math.sqrt(3)/2, -1/2),
            vec2(-1/Math.sqrt(2), -1/Math.sqrt(2)),
            vec2(-1/2, -Math.sqrt(3)/2),
            vec2(0, -1),
            vec2(1/2, -Math.sqrt(3)/2),
            vec2(1/Math.sqrt(2), -1/Math.sqrt(2)),
            vec2(Math.sqrt(3)/2, -1/2),
            vec2(1, 0),
        ];

    }

    init() {
        this.vBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.points), gl.STATIC_DRAW);
    };

    draw() {
        // Remember, root of defined coordinates is hard-set to (0, 0)
        var tm = translate(this.x, this.y, 0.0);
        tm = mult(tm, scale(this.radius, this.radius, 1.0)); // rotates by 0 degrees
        gl.uniformMatrix4fv(transformation, gl.FALSE, flatten(tm));

        // send the color as a uniform variable
        gl.uniform4fv(uColor, flatten(this.color));

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, this.points.length);
    };
}

class VisBullet {

    constructor(color, x, y, radius) {
        this.outerCircle = new Circle(color, x, y, radius*1.25);
        this.innerCircle = new Circle(vec4(1.0, 1.0, 1.0, 1.0), x, y, radius);
    }

    setPosition(x, y) {
        this.outerCircle.x = x;
        this.outerCircle.y = y;
        this.innerCircle.x = x;
        this.innerCircle.y = y;
    }

    setRadius(radius) {
        this.outerCircle.radius = radius*1.25;
        this.innerCircle.radius = radius;
    }

    playerColliding() {
        var hitRadius = this.innerCircle.radius + HURTBOX_RADIUS;
        var dist_x = player.x - this.innerCircle.x;
        var dist_y = player.y - this.innerCircle.y;
        var dist2 = dist_x*dist_x + dist_y*dist_y
        if (dist2 <= hitRadius*hitRadius) {
            playerHit = true;
            console.log("Hit!");
        }
    }

    init() {
        this.outerCircle.init();
        this.innerCircle.init();
    }

    draw() {
        this.outerCircle.draw();
        this.innerCircle.draw();
    }

}

class BulletRing {

    constructor(color, x, y, density, offset, speed, bulletRadius) {
        this.color = color;
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.speed = speed;
        this.density = density;
        this.bulletRadius = bulletRadius;

        this.bullets = [];
        this.angles = [];
        var angle = offset;
        for (var i = 0; i < density; i++) {
            this.bullets.push(new VisBullet(color, x, y, bulletRadius));
            this.angles.push(angle);
            angle += 2.0*Math.PI/density;
        }

        this.max_radius = Math.max(y, canvas.height - y) + bulletRadius;
    }

    init() {
        for (var i = 0; i < this.density; i++) {
            this.bullets[i].init();
        }
    }

    update(delta_ms) {
        this.radius += this.speed * delta_ms / 1000.0;

        for (var i = 0; i < this.density; i++) {
            var x = this.x + this.radius * Math.cos(this.angles[i]);
            var y = this.y + this.radius * Math.sin(this.angles[i]);
            this.bullets[i].setPosition(x, y);
        }

        // Check for collision with player
        var hitRadius = this.bulletRadius + HURTBOX_RADIUS;

        // First, make sure they're within the ring
        var dist_x = player.x - this.x;
        var dist_y = player.y - this.y;
        var dist2 = dist_x*dist_x + dist_y*dist_y
        var minDist2 = (this.radius - hitRadius) * (this.radius - hitRadius)
        var maxDist2 = (this.radius + hitRadius) * (this.radius + hitRadius)

        // If so, start checking individual bullets
        if (minDist2 <= dist2 && dist2 <= maxDist2) {
            for (var i = 0; i < this.density; i++) {
                this.bullets[i].playerColliding();
            }
        }
    }

    isCleanable() {
        return this.radius >= this.max_radius;
    }

    draw() {
        for (var i = 0; i < this.density; i++) {
            this.bullets[i].draw();
        }
    }

}

class RingFactory {

    constructor(color, x, y, variance, speed, density, bulletRadius, period) {
        this.color = color;
        this.x = x;
        this.y = y;
        this.variance = variance;
        this.density = density;
        this.speed = speed;
        this.bulletRadius = bulletRadius;
        this.period = period;
        this.timer = 0;
    }

    timerTriggered(delta_ms) {
        this.timer += delta_ms / 1000.0;
        if (this.timer > this.period) {
            this.timer -= this.period;
            return true;
        }
        return false;
    }

    spawnBulletRing() {
        var angle = Math.random() * 2 * Math.PI;
        var dist = Math.random() * this.variance;
        var x = this.x + dist*Math.cos(angle);
        var y = this.y + dist*Math.sin(angle);
        var offset = Math.random() * 2 * Math.PI / this.density;

        return new BulletRing(this.color, x, y, this.density, offset, this.speed, this.bulletRadius);
    }

}

class Player {
    constructor(color, x, y) {

        this.color = color;
        this.x = x;
        this.y = y;
        this.angle = 0;

        this.points = [
            vec2(-20, -20),
            vec2(0, 30),
            vec2(20, -20),
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

        var mouseDistX = Math.floor(mouseX - this.x);
        var mouseDistY = Math.floor(mouseY - this.y);

        var dist = Math.sqrt(mouseDistX*mouseDistX + mouseDistY*mouseDistY)

        if (Math.abs(dist) > 3) {
            if (mouseDistY != 0) {
                this.angle = Math.atan(mouseDistX/mouseDistY);
                if (mouseDistY < 0) this.angle += Math.PI;
            } else {
                this.angle = Math.PI/2;
                if (mouseDistX < 0) this.angle += Math.PI;
            }
        }

        if (mouseDistX*mouseDistX + mouseDistY*mouseDistY <= speed*speed) {
            this.x = mouseX;
            this.y = mouseY;
        } else {
            this.x += speed*mouseDistX/dist;
            this.y += speed*mouseDistY/dist;
        }
    }

    draw() {
        // Remember, root of defined coordinates is hard-set to (0, 0)
        var tm = translate(this.x, this.y, 0.0);
        tm = mult(tm, rotate(this.angle*180/Math.PI, vec3(0, 0, 1)));
        gl.uniformMatrix4fv(transformation, gl.FALSE, flatten(tm));

        // send the color as a uniform variable
        gl.uniform4fv(uColor, flatten(this.color));

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
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

    document.getElementById("ButtonProj5").onclick = function(){window.open("http://sheargrub.com/cs-435-projects/Project5/texmap.html","_self");};
    document.getElementById("ButtonProj6").onclick = function(){window.open("http://sheargrub.com/cs-435-projects/Project6/blending.html","_self");};

    //
    //  Load shaders and initialize attribute buffers
    //
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    projection = gl.getUniformLocation( program, "projection" );
    var pm = ortho( 0.0, canvas.width, 0.0, canvas.height, -1.0, 1.0 );
    gl.uniformMatrix4fv( projection, gl.FALSE, flatten(pm) );

    transformation = gl.getUniformLocation( program, "transformation" );

    uColor = gl.getUniformLocation( program, "uColor" );

    vPosition = gl.getAttribLocation( program, "aPosition" );
    //vColor = gl.getAttribLocation( program, "aColor" );

    //
    // Load objects and begin
    //

    bgGridFar = new BackgroundGrid(vec4(0.2, 0.0, 0.4, 1.0), 30, 28, 120, 100);
    bgGridFar.init();
    bgGridNear = new BackgroundGrid(vec4(0.1, 0.4, 0.5, 1.0), 18, 14, 85, 55);
    bgGridNear.init();

    player = new Player(vec4(0.4, 0.0, 0.3, 1.0), 250, 500);
    player.init();

    hurtboxOuter = new Circle(vec4(0.8, 0.2, 0.3, 1.0), 250, 500, 0);
    hurtboxOuter.init();
    hurtboxInner = new Circle(vec4(1.0, 1.0, 1.0, 1.0), 250, 500, 0);
    hurtboxInner.init();

    followLine = new Line(vec4(1.0, 0.7, 0.9, 1.0), canvas.width/2, canvas.height/2, canvas.width/2, canvas.height/2);
    followLine.init();

    bulletRings = [];
    ringFactories = [];

    timerStart = Date.now();

    setInterval(function () {update(FRAMETIME_MS)}, FRAMETIME_MS);
}

function buffRings(type) {
    switch (type) {
        case 0:
            for (var i = 0; i < ringFactories.length; i++) {
                ringFactories[i].speed += 30;
            }
            break;
        case 1:
            for (var i = 0; i < ringFactories.length; i++) {
                ringFactories[i].variance += 8;
            }
            break;
        case 2:
            for (var i = 0; i < ringFactories.length; i++) {
                ringFactories[i].density += 2;
            }
            break;
        case 3:
            for (var i = 0; i < ringFactories.length; i++) {
                ringFactories[i].period *= 0.85;
            }
            break;
    }
}

function update(delta_ms) {
    bgGridNear.update(delta_ms);
    bgGridFar.update(delta_ms);

    if (mouseInField) {
        player.updateWithMouse();
        followLine.points[0] = vec2(player.x, player.y);
        followLine.points[1] = vec2(mouseX, mouseY);
    }

    hurtboxInner.x = player.x;
    hurtboxInner.y = player.y;
    hurtboxOuter.x = player.x;
    hurtboxOuter.y = player.y;
    if (focusHeld && hurtboxInner.radius < HURTBOX_RADIUS) {
        hurtboxInner.radius += 4 * (delta_ms/1000) * HURTBOX_RADIUS;
        hurtboxOuter.radius += 4 * (delta_ms/1000) * (HURTBOX_RADIUS+3);
    } else if (hurtboxInner.radius != 0) {
        hurtboxInner.radius -= 8 * (delta_ms/1000) * HURTBOX_RADIUS;
        hurtboxOuter.radius -= 8 * (delta_ms/1000) * (HURTBOX_RADIUS+3);
        if (hurtboxInner.radius < 0) {
            hurtboxOuter.radius = 0;
            hurtboxInner.radius = 0;
        }
    }

    for (var i = 0; i < ringFactories.length; i++) {
        if (ringFactories[i].timerTriggered(delta_ms)) {
            var br = ringFactories[i].spawnBulletRing();
            br.init();
            bulletRings.push(br);
        }
    }

    for (var i = 0; i < bulletRings.length; i++) {
        bulletRings[i].update(delta_ms);
        if (bulletRings[i].isCleanable()) {
            bulletRings.splice(i, 1);
            i--;
        }
    }

    clickPressed = false;
    focusPressed = false;

    var timerNow = Math.round((Date.now() - timerStart)/1000);
    var timerString = "Current time: " + timerNow.toString() + " seconds";
    document.getElementById("timerfield").textContent = timerString;

    if (timerNow < 65) {
        if (timerNow >= PHASE_TIMINGS[phase]) {
            phase++;
            document.getElementById("alertfield").textContent = "[" + timerNow.toString() + "s] " + PHASE_TEXT[phase];

            // Primary rings
            if (phase == 1) {
                ringFactories.push(new RingFactory(vec4(0.8, 0.2, 0.3, 1.0), 250, 600, 50, 100, 10, 12, 0.7));
            }

            // Secondary rings
            else if (phase == 6) {
                ringFactories.push(new RingFactory(vec4(0.2, 0.2, 0.8, 1.0), 100, 680, 60, 100, 8, 12, 0.9));
                ringFactories.push(new RingFactory(vec4(0.2, 0.2, 0.8, 1.0), 400, 680, 60, 100, 8, 12, 0.9));
            }

            else {
                buffRings(phase-2);
            }

        }
    } else if (timerNow/10 >= phase+1) {
        phase++;
        var behavior = Math.floor(Math.random()*4);
        document.getElementById("alertfield").textContent = "[" + timerNow.toString() + "s] " + BEHAVIOR_TEXT[behavior] + " up!";
        buffRings(behavior);
    }

    render();
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    bgGridFar.draw();
    bgGridNear.draw();

    if (mouseInField) followLine.draw();
    player.draw();
    hurtboxOuter.draw();
    hurtboxInner.draw();

    for (var i = 0; i < bulletRings.length; i++) {
        bulletRings[i].draw();
    }
}