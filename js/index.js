"use strict";

/*************************************************************************************************************************
 Shaders
 *************************************************************************************************************************/

var vs = `#version 300 es

in vec4 a_position;
in vec4 a_color;

uniform mat4 u_matrix;

out vec4 v_color;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;

  // Pass the color to the fragment shader.
  v_color = a_color;
}
`;
var fs = `#version 300 es
precision highp float;

// Passed in from the vertex shader.
in vec4 v_color;

uniform vec4 u_colorMult;
uniform vec4 u_colorOffset;

out vec4 outColor;

void main() {
   outColor = v_color * u_colorMult + u_colorOffset;
}
`;

/*************************************************************************************************************************
 Class Node
 *************************************************************************************************************************/

var Node = function() {
  this.children = [];
  this.localMatrix = m4.identity();
  this.worldMatrix = m4.identity();
};

Node.prototype.setParent = function(parent) {
  if (this.parent) {
    var ndx = this.parent.children.indexOf(this);
    if (ndx >= 0) {
      this.parent.children.splice(ndx, 1);
    }
  }
  if (parent) {
    parent.children.push(this);
  }
  this.parent = parent;
};

Node.prototype.updateWorldMatrix = function(matrix) {
  if (matrix) {
    m4.multiply(matrix, this.localMatrix, this.worldMatrix);
  } else {
    m4.copy(this.localMatrix, this.worldMatrix);
  }
  // now process all the children
  var worldMatrix = this.worldMatrix;
  this.children.forEach(function(child) {
    child.updateWorldMatrix(worldMatrix);
  });
};

/*************************************************************************************************************************
 Class Camera
 *************************************************************************************************************************/

var Camera = function() {
  this.viewProjectionMatrix = m4.identity();
  this.projectionMatrix = m4.identity();
  this.cameraMatrix = m4.identity();
  this.viewMatrix = m4.identity();

  this.cameraPosition = [0, 500, 0];
  this.target = [0, 0, 0];
  this.fieldOfView = 0;
  this.up = [0, 0, 1];
  this.aspect = 2;
};

Camera.prototype.setAttributes = function(cameraPosition, target, up, aspect, fieldOfView) {
  this.fieldOfView = degToRad(fieldOfView);
  this.cameraPosition = cameraPosition;
  this.target = target;
  this.aspect = aspect;
  this.up = up;
};

Camera.prototype.setMatrix = function() {
  this.projectionMatrix = m4.perspective(this.fieldOfView, this.aspect, 1, 2000);
  this.cameraMatrix = m4.lookAt(this.cameraPosition, this.target, this.up);
  this.viewMatrix = m4.inverse(this.cameraMatrix);
  this.viewProjectionMatrix = m4.multiply(this.projectionMatrix, this.viewMatrix);
};

/*************************************************************************************************************************
 Global Variables
 *************************************************************************************************************************/

var programInfo;
var canvas;
var gl;

var objectsToDraw = [];
var objects = [];

var cameras = [];
var cameraIndex = 1;

/*************************************************************************************************************************
 Buffers
 *************************************************************************************************************************/

var sphereBufferInfo;
var sphereVAO;

/*************************************************************************************************************************
 Solar System Variables
 *************************************************************************************************************************/

//Solar System
var solarSystemNode;
//Orbits
var mercuryOrbitNode;
var venusOrbitNode;
var earthOrbitNode;
var moonOrbitNode;
var marsOrbitNode;
var jupterOrbitNode;
var saturnOrbitNode;
var uranusOrbitNode;
var neptuneOrbitNode;
//Solar system components
var sunNode;
var mercuryNode;
var venusNode;
var earthNode;
var moonNode;
var marsNode;
var jupterNode;
var saturnNode;
var uranusNode;
var neptuneNode;

/*************************************************************************************************************************
 Main
 *************************************************************************************************************************/

function main() {

  initProgram();
  setSphere();

  setCameras();

  setSolarSystemNodes();
  configSolarSystem();  

  requestAnimationFrame(drawScene);
}

/*************************************************************************************************************************
 Functions
 *************************************************************************************************************************/

function initProgram() {
  canvas = document.querySelector("#canvas");
  gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }
  twgl.setAttributePrefix("a_");   // Tell the twgl to match position with a_position, normal with a_normal etc..
  programInfo = twgl.createProgramInfo(gl, [vs, fs]);  // setup GLSL program
}

function setCameras() {
  cameras.push(new Camera);
  cameras.push(new Camera);

  cameras[0].setAttributes( // Camera 0
    [0,700,0], // position
    [0,0,0],   // target
    [0,0,1],   // up
    gl.canvas.clientWidth / gl.canvas.clientHeight, // aspect
    60  // fieldOfView
  );

  cameras[1].setAttributes( // Camera 1
    [0,400,1000], // position
    [0,0,0],   // target
    [0,1,0],   // up
    gl.canvas.clientWidth / gl.canvas.clientHeight, // aspect
    60  // fieldOfView
  );
}

function setSphere() {
 sphereBufferInfo = flattenedPrimitives.createSphereBufferInfo(gl, 10, 50, 20);
 sphereVAO = twgl.createVAOFromBufferInfo(gl, programInfo, sphereBufferInfo);
}

function setSolarSystemNodes() {
  //Solar System
  solarSystemNode = new Node();
  //Orbits
  mercuryOrbitNode = new Node();
  venusOrbitNode = new Node();
  earthOrbitNode = new Node();
  marsOrbitNode = new Node();
  moonOrbitNode = new Node();
  jupterOrbitNode = new Node();
  saturnOrbitNode = new Node();
  uranusOrbitNode = new Node();
  neptuneOrbitNode = new Node();
  //Solar system components
  sunNode = new Node();
  mercuryNode = new Node();
  venusNode = new Node();
  earthNode = new Node();
  marsNode = new Node();
  moonNode = new Node();
  jupterNode = new Node();
  saturnNode = new Node();
  uranusNode = new Node();
  neptuneNode = new Node();
}

function configSolarSystem() {
  mercuryOrbitNode.localMatrix = m4.translation(150, 0, 0); // earth orbit 100 units from the sun
  venusOrbitNode.localMatrix = m4.translation(250, 0, 0);   // earth orbit 200 units from the sun
  earthOrbitNode.localMatrix = m4.translation(350, 0, 0);   // earth orbit 300 units from the sun
  moonOrbitNode.localMatrix = m4.translation(30, 0, 0);     // moon 30 units from the earth
  marsOrbitNode.localMatrix = m4.translation(450, 0, 0);    // earth orbit 400 units from the sun
  jupterOrbitNode.localMatrix = m4.translation(550, 0, 0);    // earth orbit 500 units from the sun
  saturnOrbitNode.localMatrix = m4.translation(650, 0, 0);    // earth orbit 600 units from the sun
  uranusOrbitNode.localMatrix = m4.translation(750, 0, 0);    // earth orbit 700 units from the sun
  neptuneOrbitNode.localMatrix = m4.translation(850, 0, 0);    // earth orbit 800 units from the sun

  sunNode.localMatrix = m4.scaling(7, 7, 7);  // sun
  sunNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.6, 0.6, 0, 1], // yellow
      u_colorMult:   [0.4, 0.4, 0, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  mercuryNode.localMatrix = m4.scaling(0.8, 0.8, 0.8); // mercury
  mercuryNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.8, 0.4, 0.4, 1],  // red
      u_colorMult:   [0.8, 0.5, 0.2, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  venusNode.localMatrix = m4.scaling(1.25, 1.25, 1.25); // venus
  venusNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.8, 0.5, 0.2, 1],  // blue-green
      u_colorMult:   [0.8, 0.5, 0.2, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  earthNode.localMatrix = m4.scaling(1.3, 1.3, 1.3); // earth
  earthNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
      u_colorMult:   [0.8, 0.5, 0.2, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  moonNode.localMatrix = m4.scaling(0.3, 0.3, 0.3); // moon
  moonNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.6, 0.6, 0.6, 1],  // gray
      u_colorMult:   [0.1, 0.1, 0.1, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  marsNode.localMatrix = m4.scaling(1, 1, 1); // mars
  marsNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.8, 0.3, 0.3, 1],  // red
      u_colorMult:   [0.8, 0.3, 0.3, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  jupterNode.localMatrix = m4.scaling(2.5, 2.5, 2.5); // jupter
  jupterNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.8, 0.3, 0.8, 1],  // purple
      u_colorMult:   [0.8, 0.3, 0.8, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  saturnNode.localMatrix = m4.scaling(2.1, 2.1, 2.1); // saturn
  saturnNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.8, 0.8, 0.5, 1],  // brown
      u_colorMult:   [0.5, 0.5, 0.4, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  uranusNode.localMatrix = m4.scaling(1.5, 1.5, 1.5); // uranus
  uranusNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.1, 0.8, 0.5, 1],  // blue-green
      u_colorMult:   [0.1, 0.8, 0.8, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  neptuneNode.localMatrix = m4.scaling(1.2, 1.2, 1.2); // neptune
  neptuneNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.1, 0.1, 0.8, 1],  // blue
      u_colorMult:   [0.1, 0.1, 0.8, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  // connect the celetial objects
  sunNode.setParent(solarSystemNode);

  mercuryOrbitNode.setParent(solarSystemNode);
  venusOrbitNode.setParent(solarSystemNode);
  earthOrbitNode.setParent(solarSystemNode);
  moonOrbitNode.setParent(earthOrbitNode);
  marsOrbitNode.setParent(solarSystemNode);
  jupterOrbitNode.setParent(solarSystemNode);
  saturnOrbitNode.setParent(solarSystemNode);
  uranusOrbitNode.setParent(solarSystemNode);
  neptuneOrbitNode.setParent(solarSystemNode);

  mercuryNode.setParent(mercuryOrbitNode);
  venusNode.setParent(venusOrbitNode);
  earthNode.setParent(earthOrbitNode);  
  moonNode.setParent(moonOrbitNode);
  marsNode.setParent(marsOrbitNode);
  jupterNode.setParent(jupterOrbitNode);
  saturnNode.setParent(saturnOrbitNode);
  uranusNode.setParent(uranusOrbitNode);
  neptuneNode.setParent(neptuneOrbitNode);

  objects = [
    sunNode,
    mercuryNode,
    venusNode,
    earthNode,
    moonNode,
    marsNode,
    jupterNode,
    saturnNode,
    uranusNode,
    neptuneNode,
  ];

  objectsToDraw = [
    sunNode.drawInfo,
    mercuryNode.drawInfo,
    venusNode.drawInfo,
    earthNode.drawInfo,
    moonNode.drawInfo,
    marsNode.drawInfo,
    jupterNode.drawInfo,
    saturnNode.drawInfo,
    uranusNode.drawInfo,
    neptuneNode.drawInfo,
  ];
}

function setTranslationMoviment() {
  // translation moviment.
  m4.multiply(m4.yRotation(0.03), mercuryOrbitNode.localMatrix, mercuryOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.0115), venusOrbitNode.localMatrix, venusOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.01), earthOrbitNode.localMatrix, earthOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.01), moonOrbitNode.localMatrix, moonOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.005), marsOrbitNode.localMatrix, marsOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.0009), jupterOrbitNode.localMatrix, jupterOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.0005), saturnOrbitNode.localMatrix, saturnOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.0003), uranusOrbitNode.localMatrix, uranusOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.0002), neptuneOrbitNode.localMatrix, neptuneOrbitNode.localMatrix);
}

function setRotationMoviment() {
  // rotation moviment
  m4.multiply(m4.yRotation(0.001), sunNode.localMatrix, sunNode.localMatrix);
  m4.multiply(m4.yRotation(0.005), mercuryNode.localMatrix, mercuryNode.localMatrix);
  m4.multiply(m4.yRotation(0.0015), venusNode.localMatrix, venusNode.localMatrix);
  m4.multiply(m4.yRotation(0.04), earthNode.localMatrix, earthNode.localMatrix); 
  m4.multiply(m4.yRotation(-0.01), moonNode.localMatrix, moonNode.localMatrix);
  m4.multiply(m4.yRotation(0.04), marsNode.localMatrix, marsNode.localMatrix);
  m4.multiply(m4.yRotation(0.06), jupterNode.localMatrix, jupterNode.localMatrix);
  m4.multiply(m4.yRotation(0.07), saturnNode.localMatrix, saturnNode.localMatrix);
  m4.multiply(m4.yRotation(0.08), uranusNode.localMatrix, uranusNode.localMatrix);
  m4.multiply(m4.yRotation(0.09), neptuneNode.localMatrix, neptuneNode.localMatrix);
}

function drawScene(time) {
  time *= 0.001;

  configScene();

  cameras[cameraIndex].setMatrix();

  setTranslationMoviment();
  setRotationMoviment();  

  solarSystemNode.updateWorldMatrix(); // Update all world matrices in the scene graph

  // Compute all the matrices for rendering
  objects.forEach(function(object) {
      object.drawInfo.uniforms.u_matrix = m4.multiply(cameras[cameraIndex].viewProjectionMatrix, object.worldMatrix);
  });

  // ------ Draw the objects --------

  twgl.drawObjectList(gl, objectsToDraw);
  requestAnimationFrame(drawScene);
}

function configScene() {
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); // Tell WebGL how to convert from clip space to pixels
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  // Clear the canvas AND the depth buffer.
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function degToRad(d) {
  return d * Math.PI / 180;
}

/*************************************************************************************************************************/

main();
