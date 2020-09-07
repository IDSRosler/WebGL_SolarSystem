"use strict";

/*************************************************************************************************************************
 Shaders
 *************************************************************************************************************************/

var vs = `#version 300 es

in vec4 a_position;
in vec3 a_normal;
in vec2 a_texcoord;

uniform vec3 u_lightWorldPosition[7]; //position of ligth

uniform mat4 u_world;
uniform mat4 u_worldViewProjection;
uniform mat4 u_worldInverseTranspose;

out vec3 v_surfaceToLight[7];
out vec3 v_normal;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_texcoord;
  gl_Position = u_worldViewProjection * a_position;       // Multiply the position by the matrix.
  v_normal = mat3(u_worldInverseTranspose) * a_normal;    // orient the normals and pass to the fragment shader
  vec3 surfaceWorldPosition = (u_world * a_position).xyz; // compute the world position of the surface
 
  // compute the vector of the surface to the light
  for(int i = 0; i<7; i++){
    v_surfaceToLight[i] = u_lightWorldPosition[i] - surfaceWorldPosition;
  }
}
`;
var fs = `#version 300 es
precision highp float;

in vec2 v_texCoord;
in vec3 v_normal;
in vec3 v_surfaceToLight[7];

uniform vec3 u_lightDirection[7];
uniform vec3 u_lightColor;
uniform vec4 u_colorMult;
uniform sampler2D u_diffuse;
uniform float u_limit[7];

out vec4 outColor;

void main() {
  vec4 diffuseColor = texture(u_diffuse, v_texCoord);
  vec3 normal = normalize(v_normal);

  vec3 surfaceToLightDirection[7];

  for(int i = 0; i<7; i++){
    surfaceToLightDirection[i] = normalize(v_surfaceToLight[i]);
  }

  float light;
  float dotFromDirection;
  float brightness = 0.05;
  float ambient = 0.01;

  for(int i = 0; i<7; i++){
    dotFromDirection = dot(surfaceToLightDirection[i],-u_lightDirection[i]);
    if (dotFromDirection >= u_limit[i]) {
      light = max(0.0,dot(normal, surfaceToLightDirection[i]));
    }
    outColor.rgb += u_lightColor * diffuseColor.rgb * brightness * light * u_colorMult.rgb;
  }
  outColor.rgb += ambient;
  outColor.a = diffuseColor.a;
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
  this.near = 1;
  this.far = 2000;
};

Camera.prototype.setAttributes = function(cameraPosition, target, up, aspect, fieldOfView, near, far) {
  this.fieldOfView = degToRad(fieldOfView);
  this.cameraPosition = cameraPosition;
  this.target = target;
  this.aspect = aspect;
  this.up = up;
  this.near = near;
  this.far = far;
};

Camera.prototype.setMatrix = function() {
  this.projectionMatrix = m4.perspective(this.fieldOfView, this.aspect, this.near, this.far);
  this.cameraMatrix = m4.lookAt(this.cameraPosition, this.target, this.up);
  this.viewMatrix = m4.inverse(this.cameraMatrix);
  this.viewProjectionMatrix = m4.multiply(this.projectionMatrix, this.viewMatrix);
};

/*************************************************************************************************************************
 Class Lights
 *************************************************************************************************************************/

var Light = function() {};

/*************************************************************************************************************************
 Gui variables
 *************************************************************************************************************************/

 var config = {
   cameraSelected: "Front",
   planetSelected: "Mercury"
 }

/*************************************************************************************************************************
 Global Variables
 *************************************************************************************************************************/

 // setup GLSL program
var program;
var uniformSetters;
var attribSetters;
var attribs;
var canvas;
var gl;
var then = 0;

var objectsToDraw = [];
var objects = [];

var cameras = [];
var cameraIndex = 1;

/*************************************************************************************************************************
 Buffers
 *************************************************************************************************************************/

var sphereBuffer;
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
 Textures
 *************************************************************************************************************************/

var sunTexture;
var mercuryTexture;
var venusTexture;
var earthTexture;
var moonTexture;
var marsTexture;
var jupterTexture;
var saturnTexture;
var uranusTexture;
var neptuneTexture;

/*************************************************************************************************************************
 Main
 *************************************************************************************************************************/

function main() {
  renderGUI();

  initProgram();

  setSphere();
  setTextures();

  setStaticCameras();

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
   // setup GLSL program
   program = twgl.createProgramFromSources(gl, [vs, fs]);
   uniformSetters = twgl.createUniformSetters(gl, program);
   attribSetters  = twgl.createAttributeSetters(gl, program);
}

function setSphere() {
  sphereBuffer = twgl.primitives.createSphereBuffers(gl, 10, 50, 50);

  attribs = {
    a_position: { buffer: sphereBuffer.position, numComponents: 3, },
    a_normal:   { buffer: sphereBuffer.normal,   numComponents: 3, },
    a_texcoord: { buffer: sphereBuffer.texcoord, numComponents: 2, },
  };

  sphereVAO = twgl.createVAOAndSetAttributes(gl, attribSetters, attribs, sphereBuffer.indices);

  console.log(sphereBuffer);
}

function setTextures(){
  sunTexture = loadTexture("../textures/sunTexture.jpg");
  mercuryTexture = loadTexture("../textures/mercuryTexture.jpg");
  venusTexture = loadTexture("../textures/venusTexture.jpg");
  earthTexture = loadTexture("../textures/earthTexture.jpg");
  moonTexture = loadTexture("../textures/moonTexture.jpg");
  marsTexture = loadTexture("../textures/marsTexture.jpg");
  jupterTexture = loadTexture("../textures/jupterTexture.jpg");
  saturnTexture = loadTexture("../textures/saturnTexture.jpg");
  uranusTexture = loadTexture("../textures/uranusTexture.jpg");
  neptuneTexture = loadTexture("../textures/neptuneTexture.jpg");
}

function setStaticCameras() {
  cameras.push(new Camera);
  cameras.push(new Camera);
  cameras.push(new Camera);

  cameras[0].setAttributes( // Camera 0 (up)
    [0,700,0], // position
    [0,0,0],   // target
    [0,0,1],   // up
    gl.canvas.clientWidth / gl.canvas.clientHeight, // aspect
    60,  // fieldOfView
    1,  // near
    2000  // far
  );

  cameras[1].setAttributes( // Camera 1 (front)
    [0,400,1000], // position
    [0,0,0],   // target
    [0,1,0],   // up
    gl.canvas.clientWidth / gl.canvas.clientHeight, // aspect
    60,  // fieldOfView
    1,  // near
    2000  // far
  );
}

function setPlanetCamera(name) {
  var cameraPosition;
  var cameraTarget;
  var cameraFieldOfView;
  var cameraNear;
  var cameraFar;

  if (name == "Mercury") {
    cameraPosition = [mercuryOrbitNode.localMatrix[12]-50, mercuryOrbitNode.localMatrix[13], mercuryOrbitNode.localMatrix[14]];
    cameraTarget = [mercuryOrbitNode.localMatrix[12], mercuryOrbitNode.localMatrix[13], mercuryOrbitNode.localMatrix[14]];
    cameraFieldOfView = 60;
    cameraNear = 1;
    cameraFar = 65;
  }
  else if (name == "Venus") {
    cameraPosition = [venusOrbitNode.localMatrix[12]-50, venusOrbitNode.localMatrix[13], venusOrbitNode.localMatrix[14]];
    cameraTarget = [venusOrbitNode.localMatrix[12], venusOrbitNode.localMatrix[13], venusOrbitNode.localMatrix[14]];
    cameraFieldOfView = 60;
    cameraNear = 1;
    cameraFar = 80;
  }
  else if (name == "Earth") {
    cameraPosition = [earthOrbitNode.localMatrix[12]-50, earthOrbitNode.localMatrix[13], earthOrbitNode.localMatrix[14]];
    cameraTarget = [earthOrbitNode.localMatrix[12], earthOrbitNode.localMatrix[13], earthOrbitNode.localMatrix[14]];
    cameraFieldOfView = 60;
    cameraNear = 1;
    cameraFar = 80;
  }

  cameras[2].setAttributes( 
    cameraPosition, // position
    cameraTarget,   // target
    [0,1,0],   // up
    gl.canvas.clientWidth / gl.canvas.clientHeight, // aspect
    cameraFieldOfView,  // fieldOfView
    cameraNear,  // near
    cameraFar  // far
  );
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
  mercuryOrbitNode.localMatrix = m4.translation(200, 0, 0); // earth orbit 200 units from the sun
  venusOrbitNode.localMatrix = m4.translation(300, 0, 0);   // earth orbit 300 units from the sun
  earthOrbitNode.localMatrix = m4.translation(400, 0, 0);   // earth orbit 400 units from the sun
  moonOrbitNode.localMatrix = m4.translation(30, 0, 0);     // moon 30 units from the earth
  marsOrbitNode.localMatrix = m4.translation(500, 0, 0);    // earth orbit 500 units from the sun
  jupterOrbitNode.localMatrix = m4.translation(600, 0, 0);    // earth orbit 600 units from the sun
  saturnOrbitNode.localMatrix = m4.translation(700, 0, 0);    // earth orbit 700 units from the sun
  uranusOrbitNode.localMatrix = m4.translation(800, 0, 0);    // earth orbit 800 units from the sun
  neptuneOrbitNode.localMatrix = m4.translation(900, 0, 0);    // earth orbit 900 units from the sun

  sunNode.localMatrix = m4.scaling(7, 7, 7);  // sun
  sunNode.drawInfo = {
    uniforms: {
      u_colorMult:             [50, 50, 50, 1],
      u_diffuse:               sunTexture,
    }
  };

  mercuryNode.localMatrix = m4.scaling(0.8, 0.8, 0.8); // mercury
  mercuryNode.drawInfo = {
    uniforms: {
      u_colorMult:             [6, 6, 6, 1],
      u_diffuse:               mercuryTexture,
    }
  };

  venusNode.localMatrix = m4.scaling(1.25, 1.25, 1.25); // venus
  venusNode.drawInfo = {
    uniforms: {
      u_colorMult:             [4, 4, 4, 1],
      u_diffuse:               venusTexture,
    }
  };

  earthNode.localMatrix = m4.scaling(1.3, 1.3, 1.3); // earth
  earthNode.drawInfo = {
    uniforms: {
      u_colorMult:             [5, 5, 5, 1],
      u_diffuse:               earthTexture,
    }
  };

  moonNode.localMatrix = m4.scaling(0.3, 0.3, 0.3); // moon
  moonNode.drawInfo = {
    uniforms: {
      u_colorMult:             [4, 4, 4, 1],
      u_diffuse:               moonTexture,
    }
  };

  marsNode.localMatrix = m4.scaling(1, 1, 1); // mars
  marsNode.drawInfo = {
    uniforms: {
      u_colorMult:             [5, 5, 5, 1],
      u_diffuse:               marsTexture,
    }
  };

  jupterNode.localMatrix = m4.scaling(2.5, 2.5, 2.5); // jupter
  jupterNode.drawInfo = {
    uniforms: {
      u_colorMult:             [3, 3, 3, 1],
      u_diffuse:               jupterTexture,
    }
  };

  saturnNode.localMatrix = m4.scaling(2.1, 2.1, 2.1); // saturn
  saturnNode.drawInfo = {
    uniforms: {
      u_colorMult:             [3, 3, 3, 1],
      u_diffuse:               saturnTexture,
    }
  };

  uranusNode.localMatrix = m4.scaling(1.5, 1.5, 1.5); // uranus
  uranusNode.drawInfo = {
    uniforms: {
      u_colorMult:             [3, 3, 3, 1],
      u_diffuse:               uranusTexture,
    }
  };

  neptuneNode.localMatrix = m4.scaling(1.2, 1.2, 1.2); // neptune
  neptuneNode.drawInfo = {
    uniforms: {
      u_colorMult:             [3, 3, 3, 1],
      u_diffuse:               neptuneTexture,
    }
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

function setTranslationMoviment(time) {
  var deltaTime = time - then;
  // translation moviment.
  m4.multiply(m4.yRotation(2 * deltaTime), mercuryOrbitNode.localMatrix, mercuryOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(1.3 * deltaTime), venusOrbitNode.localMatrix, venusOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(1.1 * deltaTime), earthOrbitNode.localMatrix, earthOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(2 * deltaTime), moonOrbitNode.localMatrix, moonOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.2 * deltaTime), marsOrbitNode.localMatrix, marsOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.1 * deltaTime), jupterOrbitNode.localMatrix, jupterOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.09 * deltaTime), saturnOrbitNode.localMatrix, saturnOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.05 * deltaTime), uranusOrbitNode.localMatrix, uranusOrbitNode.localMatrix);
  m4.multiply(m4.yRotation(0.02 * deltaTime), neptuneOrbitNode.localMatrix, neptuneOrbitNode.localMatrix);
}

function setRotationMoviment(time) {
  var deltaTime = time - then;
  // rotation moviment
  m4.multiply(m4.yRotation(0.001 * deltaTime), sunNode.localMatrix, sunNode.localMatrix);
  m4.multiply(m4.yRotation(0.005 * deltaTime), mercuryNode.localMatrix, mercuryNode.localMatrix);
  m4.multiply(m4.yRotation(0.0015 * deltaTime), venusNode.localMatrix, venusNode.localMatrix);
  m4.multiply(m4.yRotation(1.2 * deltaTime), earthNode.localMatrix, earthNode.localMatrix); 
  m4.multiply(m4.yRotation(-0.01 * deltaTime), moonNode.localMatrix, moonNode.localMatrix);
  m4.multiply(m4.yRotation(0.04 * deltaTime), marsNode.localMatrix, marsNode.localMatrix);
  m4.multiply(m4.yRotation(0.06 * deltaTime), jupterNode.localMatrix, jupterNode.localMatrix);
  m4.multiply(m4.yRotation(0.07 * deltaTime), saturnNode.localMatrix, saturnNode.localMatrix);
  m4.multiply(m4.yRotation(0.08 * deltaTime), uranusNode.localMatrix, uranusNode.localMatrix);
  m4.multiply(m4.yRotation(0.09 * deltaTime), neptuneNode.localMatrix, neptuneNode.localMatrix);
}

function setLights() {
  var pointLight = new Light();
  var sunLightRigth = new Light();
  var sunLightLeft = new Light();
  var sunLightUp = new Light();
  var sunLightDown = new Light();
  var sunLightFront = new Light();
  var sunLightBack = new Light();

  var lightColor = [1,1,1];

  pointLight = {
    lightWorldPosition: [0,0,0],
    lightDirection: [0,0,0],
    limit: Math.cos(degToRad(180)),
  }
  sunLightRigth = {
    lightWorldPosition: [150,0,0],
    lightDirection: [-10,0,0],
    limit: Math.cos(degToRad(90)),
  }
  sunLightLeft = {
    lightWorldPosition: [-150,0,0],
    lightDirection: [10,0,0],
    limit: Math.cos(degToRad(90)),
  }
  sunLightUp = {
    lightWorldPosition: [0,150,0],
    lightDirection: [0,-10,0],
    limit: Math.cos(degToRad(90)),
  }
  sunLightDown = {
    lightWorldPosition: [0,-150,0],
    lightDirection: [0,10,0],
    limit: Math.cos(degToRad(90)),
  }
  sunLightFront = {
    lightWorldPosition: [0,0,-150],
    lightDirection: [0,0,10],
    limit: Math.cos(degToRad(90)),
  }
  sunLightBack = {
    lightWorldPosition: [0,0,150],
    lightDirection: [0,0,-10],
    limit: Math.cos(degToRad(90)),
  }


  const lightUniforms = {
    u_lightWorldPosition: pointLight.lightWorldPosition.concat(
      sunLightRigth.lightWorldPosition, 
      sunLightLeft.lightWorldPosition,
      sunLightUp.lightWorldPosition,
      sunLightDown.lightWorldPosition,
      sunLightFront.lightWorldPosition,
      sunLightBack.lightWorldPosition
    ),
    u_lightDirection: pointLight.lightDirection.concat(
      sunLightRigth.lightDirection, 
      sunLightLeft.lightDirection,
      sunLightUp.lightDirection,
      sunLightDown.lightDirection,
      sunLightFront.lightDirection,
      sunLightBack.lightDirection
    ),
    u_limit: [
      pointLight.limit, 
      sunLightRigth.limit, 
      sunLightLeft.limit,
      sunLightUp.limit,
      sunLightDown.limit,
      sunLightFront.limit,
      sunLightBack.limit
    ],
    u_lightColor: lightColor
  }

  twgl.setUniforms(uniformSetters, lightUniforms);
}

function drawScene(time) {
  time *= 0.001;

  configScene();

  setTranslationMoviment(time);
  setRotationMoviment(time);  

  then = time;

  solarSystemNode.updateWorldMatrix(); // Update all world matrices in the scene graph

  setPlanetCamera(config.planetSelected);

  cameras[cameraIndex].setMatrix();

  setLights();
 
  // Compute all the matrices for rendering
  objects.forEach(function(object) {
    object.drawInfo.uniforms.u_worldViewProjection = m4.multiply(cameras[cameraIndex].viewProjectionMatrix, object.worldMatrix);
    var worldInverseMatrix = m4.inverse(object.worldMatrix);
    var worldInverseTransposeMatrix = m4.transpose(worldInverseMatrix);
    object.drawInfo.uniforms.u_world = object.worldMatrix;
    object.drawInfo.uniforms.u_worldInverseTranspose = worldInverseTransposeMatrix;

    twgl.setUniforms(uniformSetters, object.drawInfo.uniforms);

    // Draw the geometry.
    gl.drawElements(gl.TRIANGLES, sphereBuffer.numElements, gl.UNSIGNED_SHORT, 0);
  });
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
  
  

  gl.useProgram(program);

  // Setup all the needed attributes.
  gl.bindVertexArray(sphereVAO);
}

function degToRad(d) {
  return d * Math.PI / 180;
}

function loadTexture(url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);

  const image = new Image();
  image.onload = function() {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  };
  image.src = url;

  return texture;
}

function renderGUI() {
  const gui = new dat.GUI();

  // Folders
  const cameraFolder = gui.addFolder("Cameras");

  // Camera
  cameraFolder.add(config, "cameraSelected", "Above").options(
    "Front",
    "Above", 
    "Mercury",
    "Venus",
    "Earth"
    ).onChange(() => {
    if (config.cameraSelected == "Above") {
      cameraIndex = 0;
    }
    else if(config.cameraSelected == "Front") {
      cameraIndex = 1;
    }
    else {
      cameraIndex = 2;
      config.planetSelected = config.cameraSelected;
    }
  });
}

/*************************************************************************************************************************/

main();
