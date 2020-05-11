(function(){
  
  let { mat4 } = glMatrix;
  
  var drawingBuffers = [];
  
  function createDrawingBuffer(gl, drawing) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(drawing.points), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARAY_BUFFER, null);
    return {
      bufferObj: buffer,
      count: drawing.points.length / 2
    };
  }
  
  function main() {
    const canvas = document.getElementById('viewer');
    const gl = canvas.getContext('webgl');
    
    if (!gl) {
      alert('Looks like your browser doesn\'t support WebGL. Sorry!');
      return;
    }
    
    // Vertex shader
    const vsSource = `
      attribute vec4 aVertexPosition;
      
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      
      uniform vec4 aVertexColor;
      
      varying lowp vec4 vColor;
      void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        vColor = aVertexColor;
      }
    `;

    // Fragment shader
    const fsSource = `
      varying lowp vec4 vColor;
      void main(void) {
        gl_FragColor = vColor;
      }
    `;
    
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    const programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        vertexColor: gl.getUniformLocation(shaderProgram, 'aVertexColor'),
      },
    };
    
    // const buffers = initBuffers(gl);
    drawingsRef.once('value', function(snapshot) {
      let lastKey = undefined;
      snapshot.forEach(function(childSnapshot) {
        lastKey = childSnapshot.key;
        let drawing = childSnapshot.val();
        drawing.id = childSnapshot.key;
        let buffer = createDrawingBuffer(gl, drawing);
        drawingBuffers.push(buffer);
      });
      
      drawingsRef.on('child_added', function(data) {
        // Skip stuff we've already seen
        if (data.key <= lastKey) {
          return;
        }
        
        // We always want to see "our" drawing asap,
        // so we queue drawings to show up as they come
        // in over the wire. Once they've been seen once,
        // we put them in the `drawings` array to be randomly
        // chosen later if the queue is empty
        let drawing = data.val();
        drawing.id = data.key;
        // createThumbnailFromDrawing(drawing);
        // nextDrawingsQueue.push(drawing);
        let buffer = createDrawingBuffer(gl, drawing);
        drawingBuffers.push(buffer);
      });
    });
    
    function tick(timestamp) {
      render(gl, programInfo);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  
  // function initBuffers(gl) {
    
  //   // Position
  //   const positionBuffer = gl.createBuffer();
  //   gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  //   // const positions = [
  //   //    50.0,  50.0,
  //   //   -50.0,  50.0,
  //   //    50.0, -50.0,
  //   //   -50.0, -50.0,
  //   // ];
  //   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(window.PointsToDraw), gl.STATIC_DRAW);
    
    

  //   // Color
  //   const colors = [
  //     1.0,  1.0,  1.0,  1.0,    // white
  //     1.0,  0.0,  0.0,  1.0,    // red
  //     0.0,  1.0,  0.0,  1.0,    // green
  //     0.0,  0.0,  1.0,  1.0,    // blue
  //   ];
  //   const colorBuffer = gl.createBuffer();
  //   gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  //   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  //   return {
  //     position: positionBuffer,
  //     color: colorBuffer,
  //   };
  // };
  
  let proj = mat4.create();
  let modelView = mat4.create();
  mat4.translate(modelView, modelView, [-200, -300, 0]);
  
  let projPct = 1.0;
  let frames = 0;
  
  let currentBuffer = null;
  
  function render(gl, programInfo, buffers) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    if (drawingBuffers.length === 0) {
      return;
    }
    
    if (currentBuffer === null) {
      currentBuffer = drawingBuffers[getRandomInt(drawingBuffers.length)];
    }
    
    mat4.ortho(proj, -(300 * projPct), (300 * projPct), (400 * projPct), -(400 * projPct), -100, 100);

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute
    {
      const numComponents = 2;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, currentBuffer.bufferObj);
      gl.vertexAttribPointer(
          programInfo.attribLocations.vertexPosition,
          numComponents,
          type,
          normalize,
          stride,
          offset);
      gl.enableVertexAttribArray(
          programInfo.attribLocations.vertexPosition);
    }

    gl.useProgram(programInfo.program);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false,
        proj);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelView);
    gl.uniform4fv(
      programInfo.uniformLocations.vertexColor,
      [1.0, 1.0, 1.0, 1.0] // white
    );

    {
      const offset = 0;
      const vertexCount = currentBuffer.count;
      gl.drawArrays(gl.LINE_STRIP, offset, vertexCount);
    }
    
    projPct += 0.01;
    if (projPct > 1.5) {
      projPct = 0.667;
    }
    
    if (++frames > 100) {
      currentBuffer = drawingBuffers[getRandomInt(drawingBuffers.length)];
      frames = 0;
    }
    
  }
  
  function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
      return null;
    }

    return shaderProgram;
  }

  function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }
  
  function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
  }
  
  main();
})();