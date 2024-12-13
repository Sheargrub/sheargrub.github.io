"use strict";

/*
    CS 435, Project 5
    Ian Minor
    WebGL application that displays a textured room,
    along with a transparent cup.
*/

var canvas;
var gl;

var numPositions  = 36;

var program;
var flag = true;

var positionsArray = [];
var colorsArray = [];
var texCoordsArray = [];

var texTest;
var texWood;
var texPlastic;
var texCarpet;
var texBrick;
var texGlass;
var texBall;
var texVideo;
var elemVideo;

var wallL;
var wallB;
var wallR;
var floor;
var tvBody;
var tvScreen;
var table;
var cup;

var texture;

var powerButton;
var pauseButton;
var backButton;
var forwardButton;

var positionLoc;
var tBuffer;

var modelViewMatrix;
var projectionMatrix;

var texCoord = [
    vec2(0, 0),
    vec2(0, 1),
    vec2(1, 1),
    vec2(1, 0)
];

var vertices = [
    vec4(-0.5, -0.5,  0.5, 1.0),
    vec4(-0.5,  0.5, 0.5, 1.0),
    vec4(0.5,  0.5, 0.5, 1.0),
    vec4(0.5, -0.5, 0.5, 1.0),
    vec4(-0.5, -0.5, -0.5, 1.0),
    vec4(-0.5,  0.5, -0.5, 1.0),
    vec4(0.5,  0.5, -0.5, 1.0),
    vec4(0.5, -0.5, -0.5, 1.0)
];

var vertexColors = [
    vec4(0.0, 0.0, 0.0, 1.0),  // black
    vec4(1.0, 0.0, 0.0, 1.0),  // red
    vec4(1.0, 1.0, 0.0, 1.0),  // yellow
    vec4(0.0, 1.0, 0.0, 1.0),  // green
    vec4(0.0, 0.0, 1.0, 1.0),  // blue
    vec4(1.0, 0.0, 1.0, 1.0),  // magenta
    vec4(0.0, 1.0, 1.0, 1.0),  // white
    vec4(0.0, 1.0, 1.0, 1.0)   // cyan
];

var xAxis = 0;
var yAxis = 1;
var zAxis = 2;
var axis = xAxis;
var theta = vec3(45.0, 45.0, 45.0);

var thetaLoc;

class RectPrismObj {

    constructor(x, y, z, sx, sy, sz, tex) {
        this.x = x;
        this.y = y;
        this.z = z;

        this.sx = sx;
        this.sy = sy;
        this.sz = sz;

        this.numPositions = 36;

        this.positionsArray = [];
        this.normalsArray = [];
        this.texCoordsArray = [];

        this.texture = tex;
    }

    quad(a, b, c, d) {
        var t1 = subtract(vertices[b], vertices[a]);
        var t2 = subtract(vertices[c], vertices[b]);
        var normal = cross(t1, t2);
        normal = vec3(normal);

        this.positionsArray.push(vertices[a]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[0]);
        this.positionsArray.push(vertices[b]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[1]);
        this.positionsArray.push(vertices[c]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[2]);
        this.positionsArray.push(vertices[a]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[0]);
        this.positionsArray.push(vertices[c]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[2]);
        this.positionsArray.push(vertices[d]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[3]);
        
    }

    init() {
        this.quad(1, 0, 3, 2);
        this.quad(2, 3, 7, 6);
        this.quad(3, 0, 4, 7);
        this.quad(6, 5, 1, 2);
        this.quad(4, 5, 6, 7);
        this.quad(5, 4, 0, 1);

        this.nBuffer = gl.createBuffer();
        this.vBuffer = gl.createBuffer();
    }

    draw(inModelView) {
        bindTexture(this.texture);

        /*
        gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.normalsArray), gl.STATIC_DRAW);
        gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normalLoc);
        */

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.positionsArray), gl.STATIC_DRAW);
        gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.texCoordsArray), gl.STATIC_DRAW);

        var localModelView = mult(inModelView, translate(this.x, this.y, this.z));
        var localModelView = mult(localModelView, scale(this.sx, this.sy, this.sz));
        gl.uniformMatrix4fv(gl.getUniformLocation(program,
            "uModelViewMatrix"), false, flatten(localModelView));

        gl.drawArrays(gl.TRIANGLES, 0, this.numPositions);
    }

}

class CupObj {

    constructor(x, y, z, sx, sy, sz, tex, content) {
        this.x = x;
        this.y = y;
        this.z = z;

        this.sx = sx;
        this.sy = sy;
        this.sz = sz;

        this.numPositions1 = 18;
        this.numPositions2 = 12;

        this.positionsArray = [];
        this.normalsArray = [];
        this.texCoordsArray = [];

        this.texture = tex;
        this.content = content;
    }

    quad(a, b, c, d) {
        var t1 = subtract(vertices[b], vertices[a]);
        var t2 = subtract(vertices[c], vertices[b]);
        var normal = cross(t1, t2);
        normal = vec3(normal);

        this.positionsArray.push(vertices[a]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[0]);
        this.positionsArray.push(vertices[b]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[1]);
        this.positionsArray.push(vertices[c]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[2]);
        this.positionsArray.push(vertices[a]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[0]);
        this.positionsArray.push(vertices[c]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[2]);
        this.positionsArray.push(vertices[d]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[3]);
        
    }

    init() {
        
        // this.quad(6, 5, 1, 2); // top removed
        
        this.quad(3, 0, 4, 7);
        this.quad(5, 4, 0, 1);
        this.quad(1, 0, 3, 2);

        this.quad(2, 3, 7, 6); // left
        this.quad(4, 5, 6, 7); // front
        
        this.nBuffer = gl.createBuffer();
        this.vBuffer = gl.createBuffer();

        this.content.init();
    }

    draw(inModelView) {
        bindTexture(this.texture);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.positionsArray.slice(0, this.numPositions1)), gl.STATIC_DRAW);
        gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.texCoordsArray.slice(0, this.numPositions1)), gl.STATIC_DRAW);

        var localModelView = mult(inModelView, translate(this.x, this.y, this.z));
        var localModelView = mult(localModelView, scale(this.sx, this.sy, this.sz));
        gl.uniformMatrix4fv(gl.getUniformLocation(program,
            "uModelViewMatrix"), false, flatten(localModelView));

        gl.drawArrays(gl.TRIANGLES, 0, this.numPositions1);

        if (this.content != null) this.content.draw(inModelView);

        bindTexture(this.texture);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.positionsArray.slice(this.numPositions1, this.positionsArray.length)), gl.STATIC_DRAW);
        gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.texCoordsArray.slice(this.numPositions1, this.positionsArray.length)), gl.STATIC_DRAW);

        gl.uniformMatrix4fv(gl.getUniformLocation(program,
            "uModelViewMatrix"), false, flatten(localModelView));

        gl.drawArrays(gl.TRIANGLES, 0, this.numPositions2);
    }

}

class PlaneObj {

    constructor(x, y, z, sx, sy, sz, tex) {
        this.x = x;
        this.y = y;
        this.z = z;

        this.sx = sx;
        this.sy = sy;
        this.sz = sz;

        this.numPositions = 6;

        this.positionsArray = [];
        this.normalsArray = [];
        this.texCoordsArray = [];

        this.texture = tex;
    }

    quad(a, b, c, d) {
        var vertices = [
            vec4(-0.5, -0.5,  0, 1.0),
            vec4(-0.5,  0.5, 0, 1.0),
            vec4(0.5,  0.5, 0, 1.0),
            vec4(0.5, -0.5, 0, 1.0),
        ]

        var t1 = subtract(vertices[b], vertices[a]);
        var t2 = subtract(vertices[c], vertices[b]);
        var normal = cross(t1, t2);
        normal = vec3(normal);

        this.positionsArray.push(vertices[a]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[0]);
        this.positionsArray.push(vertices[b]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[1]);
        this.positionsArray.push(vertices[c]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[2]);
        this.positionsArray.push(vertices[a]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[0]);
        this.positionsArray.push(vertices[c]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[2]);
        this.positionsArray.push(vertices[d]);
        this.normalsArray.push(normal);
        this.texCoordsArray.push(texCoord[3]);
    }

    init() {
        this.quad(1, 0, 3, 2);
        this.nBuffer = gl.createBuffer();
        this.vBuffer = gl.createBuffer();
    }

    draw(inModelView) {
        bindTexture(this.texture);

        /*
        gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.normalsArray), gl.STATIC_DRAW);
        gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normalLoc);
        */

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.positionsArray), gl.STATIC_DRAW);
        gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.texCoordsArray), gl.STATIC_DRAW);

        var localModelView = mult(inModelView, translate(this.x, this.y, this.z));
        var localModelView = mult(localModelView, scale(this.sx, this.sy, this.sz));
        gl.uniformMatrix4fv(gl.getUniformLocation(program,
            "uModelViewMatrix"), false, flatten(localModelView));

        gl.drawArrays(gl.TRIANGLES, 0, this.numPositions);
    }

}

class TableObj {

    constructor(x, y, z, sx, sy, sz, tex) {
        this.x = x;
        this.y = y;
        this.z = z;

        this.sx = sx;
        this.sy = sy;
        this.sz = sz;

        this.prisms = [];

        this.texture = tex;
    }

    init() {
        var x = this.x; var y = this.y; var z = this.z;
        this.prisms.push(new RectPrismObj(x, y+0.15, z, 2, 0.3, 2, this.texture));
        this.prisms.push(new RectPrismObj(x+0.75, y-0.5, z+0.75, 0.3, 1, 0.3, this.texture));
        this.prisms.push(new RectPrismObj(x+0.75, y-0.5, z-0.75, 0.3, 1, 0.3, this.texture));
        this.prisms.push(new RectPrismObj(x-0.75, y-0.5, z-0.75, 0.3, 1, 0.3, this.texture));
        this.prisms.push(new RectPrismObj(x-0.75, y-0.5, z+0.75, 0.3, 1, 0.3, this.texture));

        for (var i = 0; i <= 4; i++) {
            this.prisms[i].init();
        }
    }

    draw(inModelView) {
        var localModelView = mult(inModelView, translate(this.x, this.y, this.z));
        var localModelView = mult(localModelView, scale(this.sx, this.sy, this.sz));

        for (var i = 0; i <= 4; i++) {
            this.prisms[i].draw(localModelView);
        }
    }

}

function initTexture( image ) {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
        gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
                      gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.uniform1i(gl.getUniformLocation(program, "uTexMap"), 0);
    return texture;
}

function bindTexture( texture ) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program, "uTexMap"), 0);
}

var copyVideo = false;
var tvOn = false;
var tvPaused = false;

function initVideo( video ) {
    var playing = false;
    var timeupdate = false;

    video.muted = true;
    video.loop = true;

    video.addEventListener(
        "playing",
        () => {
          playing = true;
          checkReady();
        },
        true,
    );

    video.addEventListener(
        "timeupdate",
        () => {
          timeupdate = true;
          checkReady();
        },
        true,
    );

    video.play();

    function checkReady() {
        if (playing && timeupdate) copyVideo = true;
    }

    return video;
}

function initVideoTexture() {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
         gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 20, 255]));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
}

function updateVideoTexture(gl, texture, video) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video );
}

function disableVideoTexture(gl, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 20, 255]));
}
  

function quad(a, b, c, d) {
     positionsArray.push(vertices[a]);
     colorsArray.push(vertexColors[a]);
     texCoordsArray.push(texCoord[0]);

     positionsArray.push(vertices[b]);
     colorsArray.push(vertexColors[a]);
     texCoordsArray.push(texCoord[1]);

     positionsArray.push(vertices[c]);
     colorsArray.push(vertexColors[a]);
     texCoordsArray.push(texCoord[2]);

     positionsArray.push(vertices[a]);
     colorsArray.push(vertexColors[a]);
     texCoordsArray.push(texCoord[0]);

     positionsArray.push(vertices[c]);
     colorsArray.push(vertexColors[a]);
     texCoordsArray.push(texCoord[2]);

     positionsArray.push(vertices[d]);
     colorsArray.push(vertexColors[a]);
     texCoordsArray.push(texCoord[3]);
}


function colorCube()
{
    quad(1, 0, 3, 2);
    quad(2, 3, 7, 6);
    quad(3, 0, 4, 7);
    quad(6, 5, 1, 2);
    quad(4, 5, 6, 7);
    quad(5, 4, 0, 1);
}

window.onload = function init() {

    canvas = document.getElementById("gl-canvas");

    gl = canvas.getContext('webgl2');
    if (!gl) alert("WebGL 2.0 isn't available");

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    gl.enable(gl.DEPTH_TEST);

    //
    //  Load shaders and initialize attribute buffers
    //
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    colorCube();

    var cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colorsArray), gl.STATIC_DRAW );

    var colorLoc = gl.getAttribLocation(program, "aColor");
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorLoc);

    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(positionsArray), gl.STATIC_DRAW);

    positionLoc = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);

    tBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoordsArray), gl.STATIC_DRAW);

    var texCoordLoc = gl.getAttribLocation(program, "aTexCoord");
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(texCoordLoc);

    modelViewMatrix = lookAt(vec3(1, 2.5, -5), vec3(0, 0.5, 0), vec3(0, 5, 0));

    projectionMatrix = perspective(45, canvas.width/canvas.height, 1, 50);
    gl.uniformMatrix4fv( gl.getUniformLocation(program, "uProjectionMatrix"),
    false, flatten(projectionMatrix));

    //
    // Initialize a texture
    //

    var wood = document.getElementById("texWood");
    texWood = initTexture(wood);
    var plastic = document.getElementById("texPlastic");
    texPlastic = initTexture(plastic);
    var carpet = document.getElementById("texCarpet");
    texCarpet = initTexture(carpet);
    var brick = document.getElementById("texBrick");
    texBrick = initTexture(brick);
    var glass = document.getElementById("texGlass");
    texGlass = initTexture(glass);
    var ball = document.getElementById("texBall");
    texBall = initTexture(ball);

    elemVideo = initVideo(document.getElementById("texVideo"));
    texVideo = initVideoTexture(elemVideo);

    thetaLoc = gl.getUniformLocation(program, "uTheta");

    // Initialize buttons
    powerButton = document.getElementById("ButtonPower");
    pauseButton = document.getElementById("ButtonPause");
    backButton = document.getElementById("ButtonBack");
    forwardButton = document.getElementById("ButtonForward");

    powerButton.onclick = function(){
        if (tvOn) {
            powerButton.textContent = "Power On"
            tvOn = false;
        } else {
            powerButton.textContent = "Power Off"
            tvOn = true;
        }
    }

    pauseButton.onclick = function(){
        if (tvPaused) {
            pauseButton.textContent = "Pause"
            elemVideo.play();
            tvPaused = false;
        } else {
            pauseButton.textContent = "Play"
            elemVideo.pause();
            tvPaused = true;
        }
    }

    backButton.onclick = function(){
        if (elemVideo.currentTime < 1) elemVideo.currentTime = elemVideo.duration;
        elemVideo.currentTime -= 1;
    };

    forwardButton.onclick = function(){
        elemVideo.currentTime += 1;
        if (elemVideo.currentTime >= elemVideo.duration) elemVideo.currentTime -= elemVideo.duration;
    };

    document.getElementById("ButtonProj5").onclick = function(){window.open("http://sheargrub.com/cs-435-projects/Project5/texmap.html","_self");};
    document.getElementById("ButtonProj6").onclick = function(){window.open("http://sheargrub.com/cs-435-projects/Project6/blending.html","_self");};
    document.getElementById("ButtonProj7").onclick = function(){window.open("http://sheargrub.com/cs-435-projects/Project7/proj7.html","_self");};

    // Init objects
    tvScreen = new PlaneObj(0, 0, 2.84, 1.1, 0.6, 1, texVideo); 
    tvScreen.init();
    tvBody = new RectPrismObj(0, 0, 3, 1.3, 0.8, 0.3, texPlastic);
    tvBody.init();
    table = new TableObj(0, -0.3, 2, 1, 1, 1, texWood);
    table.init();

    floor = new RectPrismObj(0, -2, 3.5, 4, 0.1, 4, texCarpet);
    floor.init();
    wallL = new RectPrismObj(-2, 0, 3.5, 0.1, 4, 4, texBrick);
    wallL.init();
    wallB = new RectPrismObj(0, 0, 5.5, 4, 4, 0.1, texBrick);
    wallB.init();
    wallR = new RectPrismObj(2, 0, 3.5, 0.1, 4, 4, texBrick);
    wallR.init();

    var ball = new RectPrismObj(0, 1, 2, 0.5, 0.5, 0.5, texBall);
    ball.init();
    cup = new CupObj(0, 1, 2, 1, 1, 1, texGlass, ball);
    cup.init();

    render();

}

var render = function() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (copyVideo) {
        if (tvOn) updateVideoTexture(gl, texVideo, elemVideo);
        else disableVideoTexture(gl, texVideo);
    }

    var mvm = modelViewMatrix;

    tvScreen.draw(mvm);
    tvBody.draw(mvm);
    table.draw(mvm);

    floor.draw(mvm);
    wallL.draw(mvm);
    wallB.draw(mvm);
    wallR.draw(mvm);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    cup.draw(mvm);
    gl.disable(gl.BLEND);

    requestAnimationFrame(render);
}
