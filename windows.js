(function(){
  
  let { mat4 } = glMatrix;
  
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
    
    const shaderProgram = GlHelpers.initShaderProgram(gl, vsSource, fsSource);

    // Collect all the info needed to use the shader program.
    // Look up which attributes our shader program is using
    // for aVertexPosition, aVevrtexColor and also
    // look up uniform locations.
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
    
    const buffers = initBuffers(gl);
    
    function tick(timestamp) {
      render(gl, programInfo, buffers);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  
  function initBuffers(gl) {
    
    // Position
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // const positions = [
    //    50.0,  50.0,
    //   -50.0,  50.0,
    //    50.0, -50.0,
    //   -50.0, -50.0,
    // ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(window.PointsToDraw), gl.STATIC_DRAW);
    
    

    // Color
    const colors = [
      1.0,  1.0,  1.0,  1.0,    // white
      1.0,  0.0,  0.0,  1.0,    // red
      0.0,  1.0,  0.0,  1.0,    // green
      0.0,  0.0,  1.0,  1.0,    // blue
    ];
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    return {
      position: positionBuffer,
      color: colorBuffer,
    };
  };
  
  let proj = mat4.create();
  let modelView = mat4.create();
  mat4.translate(modelView, modelView, [-200, -300, 0]);
  
  let projPct = 1.0;
  
  function render(gl, programInfo, buffers) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    mat4.ortho(proj, -(300 * projPct), (300 * projPct), (400 * projPct), -(400 * projPct), -100, 100);

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute
    {
      const numComponents = 2;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
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

    // // Tell WebGL how to pull out the colors from the color buffer
    // // into the vertexColor attribute.
    // {
    //   const numComponents = 4;
    //   const type = gl.FLOAT;
    //   const normalize = false;
    //   const stride = 0;
    //   const offset = 0;
    //   gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    //   gl.vertexAttribPointer(
    //       programInfo.attribLocations.vertexColor,
    //       numComponents,
    //       type,
    //       normalize,
    //       stride,
    //       offset);
    //   gl.enableVertexAttribArray(
    //       programInfo.attribLocations.vertexColor);
    // }

    

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
      const vertexCount = window.PointsToDraw.length / 2;
      gl.drawArrays(gl.LINE_STRIP, offset, vertexCount);
    }
    
    projPct += 0.01;
    if (projPct > 2.0) {
      projPct = 0.5;
    }
    
  }
  
  window.DrawPointsWithGl = function() { main(); };
})();