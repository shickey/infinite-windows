(function(){
  
  let { mat4 } = glMatrix;
  
  let DRAW_TIME = 2000; // ms
  let WAIT_TIME = 2000;
  let MOVE_TIME = 8000;
  
  var drawingBuffers = [];
  let backgroundBuffers = {};
  
  let windowBuffer = null;
  
  function main() {
    const canvas = document.getElementById('viewer');
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false });
    
    if (!gl) {
      alert('Looks like your browser doesn\'t support WebGL. Sorry!');
      return;
    }
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    let shaders = compileShaders(gl);
    
    backgroundBuffers = createBackgroundBuffers(gl);
    windowBuffer = createWindowBuffer(gl);
    
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
    
    let lastTimestamp = 0;
    function tick(timestamp) {
      let dt = timestamp - lastTimestamp;
      simulate(gl, dt);
      render(gl, shaders);
      lastTimestamp = timestamp;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  
  function compileShaders(gl) {
    let shaders = {};
    
    {
      // Line drawing shader
      const vsSource = `
        attribute vec4 aVertexPosition;
        
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        
        uniform vec4 uVertexColor;
        
        varying lowp vec4 vColor;
        void main(void) {
          gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
          vColor = uVertexColor;
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
          vertexColor: gl.getUniformLocation(shaderProgram, 'uVertexColor'),
        },
      };
      
      shaders.line = programInfo;
    }
    
    {
      // Simple triangle shader for window masks
      const vsSource = `
        attribute vec4 aVertexPosition;
        attribute vec4 aVertexColor;
        
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        
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
          vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
        },
        uniformLocations: {
          projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
          modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        },
      };
      
      shaders.simple = programInfo;
    }
    
    {
      // Texture shader (for brick background)
      const vsSource = `
        attribute vec4 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;

        varying highp vec2 vTextureCoord;

        void main(void) {
          gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
          vTextureCoord = aTextureCoord;
        }
      `;

      // Fragment shader
      const fsSource = `
        varying highp vec2 vTextureCoord;

        uniform sampler2D uSampler;

        void main(void) {
          gl_FragColor = texture2D(uSampler, vTextureCoord);
        }
      `;
      
      const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

      const programInfo = {
        program: shaderProgram,
        attribLocations: {
          vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
          textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
        },
        uniformLocations: {
          projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
          modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
          uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
        },
      };
      
      shaders.background = programInfo;
    }
    
    return shaders;
  }
  
  function createBackgroundBuffers(gl) {
    let backgroundVertBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backgroundVertBuffer);
    let backgroundVerts = [-800, -400, -800, 400, 800, -400, 800, 400];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(backgroundVerts), gl.STATIC_DRAW);
    
    let backgroundTexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backgroundTexBuffer);
    let backgroundTexCoords = [0, 0, 0, 2.0, 2.0, 0, 2.0, 2.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(backgroundTexCoords), gl.STATIC_DRAW);
    
    let bricks = loadTexture(gl, 'textures/bricks-po2-dark.png');
    
    return {
      verts: backgroundVertBuffer,
      texCoords:backgroundTexBuffer,
      tex: bricks
    }
  }
  
  function createWindowBuffer(gl) {
    let vertBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
    let verts = [-230, -330,  0.1, 0.1, 0.1, 1.0,
                  230, -330,  0.1, 0.1, 0.1, 1.0,
                    0, -100,  0.1, 0.1, 0.1, 1.0,
                    
                 -230,  330,  0.2, 0.2, 0.2, 1.0,
                  230,  330,  0.2, 0.2, 0.2, 1.0,
                    0,  100,  0.2, 0.2, 0.2, 1.0,
                    
                  230, -330,  0.3, 0.3, 0.3, 1.0,
                  230,  330,  0.3, 0.3, 0.3, 1.0,
                 -100,    0,  0.3, 0.3, 0.3, 1.0,
                  
                 -230, -330,  0.15, 0.15, 0.15, 1.0,
                 -230,  330,  0.15, 0.15, 0.15, 1.0,
                  100,    0,  0.15, 0.15, 0.15, 1.0,
                    
                 -200, -300,    0,   0,   0, 1.0,
                 -200,  300,    0,   0,   0, 1.0,
                  200, -300,    0,   0,   0, 1.0,
                  
                 -200,  300,    0,   0,   0, 1.0,
                  200, -300,    0,   0,   0, 1.0,
                  200,  300,    0,   0,   0, 1.0,];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    
    return {
      bufferObj: vertBuffer,
      count: 18
    };
  }
  
  function createDrawingBuffer(gl, drawing) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(drawing.points), gl.STATIC_DRAW);
    return {
      bufferObj: buffer,
      count: drawing.points.length / 2
    };
  }
  
  let viewBounds = {
    l: -300,
    r:  300,
    b:  400,
    t: -400
  };
  
  let modelView = mat4.create();
  mat4.translate(modelView, modelView, [-200, -300, 0]);
  
  let renderQueue = [];
  
  const SimState = {
    DRAW: 'DRAW',
    WAIT: 'WAIT',
    MOVE: 'MOVE'
  }
  
  let currentSimState = SimState.DRAW;
  
  let currentDrawing = null;
  let currentWaitTime = null;
  let currentMoveAnim = null;
  
  function simulate(gl, dt) {
    renderQueue = [];
    if (drawingBuffers.length === 0) {
      return;
    }
    
    // return;
    
    switch (currentSimState) {
      case SimState.DRAW: {
        if (currentDrawing === null) {
          currentDrawing = {
            drawing: drawingBuffers[getRandomInt(drawingBuffers.length)],
            currentTime: 0,
            totalTime: DRAW_TIME
          };
        }
        
        if (currentDrawing) {
          let drawingBuffer = currentDrawing.drawing;
          let t = clamp(currentDrawing.currentTime / currentDrawing.totalTime, 0, 1.0);
          let numPointsToDraw = clamp(Math.floor(t * drawingBuffer.count), 0, drawingBuffer.count);
          if (numPointsToDraw > 0) {
            renderQueue.push({
              buffer: drawingBuffer.bufferObj,
              count: numPointsToDraw,
              modelViewMatrix: modelView
            });
          }
          currentDrawing.currentTime += dt;
          if (t >= 1.0) {
            currentSimState = SimState.WAIT;
          }
        }
        break;
      }
      case SimState.WAIT: {
        if (currentWaitTime === null) {
          currentWaitTime = 0;
        }
        else {
          currentWaitTime += dt;
          if (currentWaitTime > WAIT_TIME) {
            currentWaitTime = null;
            currentSimState = SimState.MOVE;
          }
        }
        let drawingBuffer = currentDrawing.drawing;
        renderQueue.push({
          buffer: drawingBuffer.bufferObj,
          count: drawingBuffer.count,
          modelViewMatrix: modelView
        });
        break;
      }
      case SimState.MOVE: {
        if (currentMoveAnim === null) {
          currentMoveAnim = {
            currentTime: 0,
            totalTime: MOVE_TIME,
            x: getRandomInt(2) ? -600 : (getRandomInt(2) ? 600 : 0),
            y: getRandomInt(2) ? -800 : (getRandomInt(2) ? 800 : 0),
          }
          if (currentMoveAnim.x === 0 && currentMoveAnim.y === 0) {
            // Can't both be zero. Gotta move somewhere
            if (getRandomInt(2)) {
              currentMoveAnim.x = getRandomInt(2) ? -600 : 600
            }
            else {
              currentMoveAnim.y = getRandomInt(2) ? -800 : 800
            }
          }
        }
        else {
          let { currentTime, totalTime, x, y } = currentMoveAnim;
          if (currentTime >= totalTime) {
            // Fake it by resetting the ortho projection to be origin-centered
            currentDrawing = null;
            currentMoveAnim = null;
            mat4.ortho(proj, -300, 300, 400, -400, -100, 100);
            currentSimState = SimState.DRAW;
          }
          else {
            let t = clamp(currentTime / totalTime, 0, 1.0);
            if (t < 0.25) {
              // Zoom out
              let subT = t * 4;
              viewBounds = {
                l: -300 - (subT * 300),
                r:  300 + (subT * 300),
                b:  400 + (subT * 400),
                t: -400 - (subT * 400)
              };
            }
            else if (t < 0.75) {
              // Move
              let subT = (t - 0.25) * 2;
              viewBounds = {
                l: -600 + (subT * x),
                r:  600 + (subT * x),
                b:  800 + (subT * y),
                t: -800 + (subT * y)
              };
            }
            else {
              // Zoom in
              let subT = (t - 0.75) * 4;
              viewBounds = {
                l: -600 + (subT * 300),
                r:  600 - (subT * 300),
                b:  800 - (subT * 400),
                t: -800 + (subT * 400)
              };
            }
            
            currentMoveAnim.currentTime += dt;
          }
          
        }
        if (currentDrawing !== null) {
          let drawingBuffer = currentDrawing.drawing;
          renderQueue.push({
            buffer: drawingBuffer.bufferObj,
            count: drawingBuffer.count,
            modelViewMatrix: modelView
          });
        }
        break;
      }
    }
    
    // Figure out how many windows we need to render
    let windowVerts = [];
    let viewW = viewBounds.r - viewBounds.l;
    let viewH = viewBounds.b - viewBounds.t;
    let cellW = 600;
    let cellH = 800;
    let numWindowsX = Math.ceil(viewW / cellW) + 2;
    let numWindowsY = Math.ceil(viewH / cellH) + 2;
    
    let startX = (Math.floor(viewBounds.l / cellW) * cellW) - 200;
    let startY = (Math.floor(viewBounds.t / cellH) * cellH) - 300;
    
    for (let y = 0; y < numWindowsY; ++y) {
      for (let x = 0; x < numWindowsX; ++x) {
        minX = startX + (cellW * x);
        midX = minX + 200;
        maxX = minX + 400;
        minY = startY + (cellH * y);
        midY = minY + 300;
        maxY = minY + 600;
        windowVerts = windowVerts.concat([
          // Top
            (minX - 30),  (minY - 30),  0.1, 0.1, 0.1, 1.0,
            (maxX + 30),  (minY - 30),  0.1, 0.1, 0.1, 1.0,
                   midX, (midY - 100),  0.1, 0.1, 0.1, 1.0,
            
          // Bottom
            (minX - 30),  (maxY + 30),  0.2, 0.2, 0.2, 1.0,
            (maxX + 30),  (maxY + 30),  0.2, 0.2, 0.2, 1.0,
                   midX, (midY + 100),  0.2, 0.2, 0.2, 1.0,
            
          // Right
            (maxX + 30),  (minY - 30),  0.3, 0.3, 0.3, 1.0,
            (maxX + 30),  (maxY + 30),  0.3, 0.3, 0.3, 1.0,
           (midX - 100),         midY,  0.3, 0.3, 0.3, 1.0,
            
          // Left
            (minX - 30),  (minY - 30),  0.15, 0.15, 0.15, 1.0,
            (minX - 30),  (maxY + 30),  0.15, 0.15, 0.15, 1.0,
                             (midX + 100),         midY,  0.15, 0.15, 0.15, 1.0,
                             
          // Lower-left pane          
                   minX, minY,    0,   0,   0, 1.0,
                   minX, maxY,    0,   0,   0, 1.0,
                   maxX, minY,    0,   0,   0, 1.0,
                   
          // Upper-right pane 
                   minX, maxY,    0,   0,   0, 1.0,
                   maxX, minY,    0,   0,   0, 1.0,
                   maxX, maxY,    0,   0,   0, 1.0,]
        );
        
      }
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, windowBuffer.bufferObj);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(windowVerts), gl.STATIC_DRAW);
    windowBuffer.count = (18 * numWindowsX * numWindowsY);
    
  }
  
  let proj = mat4.create();
  
  function render(gl, shaders, buffers) {
    gl.clearColor(0.25, 0.25, 0.25, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    if (drawingBuffers.length === 0) {
      return;
    }
    
    let {l, r, b, t} = viewBounds;
    mat4.ortho(proj, l, r, b, t, -100, 100);
    
    // {
    //   // Draw background
    //   let shader = shaders.background;
    //   let {verts, texCoords, tex} = backgroundBuffers;
      
    //   {
    //     const numComponents = 2;
    //     const type = gl.FLOAT;
    //     const normalize = false;
    //     const stride = 0;
    //     const offset = 0;
    //     gl.bindBuffer(gl.ARRAY_BUFFER, verts);
    //     gl.vertexAttribPointer(
    //         shader.attribLocations.vertexPosition,
    //         numComponents,
    //         type,
    //         normalize,
    //         stride,
    //         offset);
    //     gl.enableVertexAttribArray(shader.attribLocations.vertexPosition);
    //   }
      
    //   {
    //     const num = 2; // every coordinate composed of 2 values
    //     const type = gl.FLOAT; // the data in the buffer is 32 bit float
    //     const normalize = false; // don't normalize
    //     const stride = 0; // how many bytes to get from one set to the next
    //     const offset = 0; // how many bytes inside the buffer to start from
    //     gl.bindBuffer(gl.ARRAY_BUFFER, texCoords);
    //     gl.vertexAttribPointer(shader.attribLocations.textureCoord, num, type, normalize, stride, offset);
    //     gl.enableVertexAttribArray(shader.attribLocations.textureCoord);
    //   }
      
    //   gl.useProgram(shader.program);
      
    //   gl.uniformMatrix4fv(
    //       shader.uniformLocations.projectionMatrix,
    //       false,
    //       proj);
    //   gl.uniformMatrix4fv(
    //       shader.uniformLocations.modelViewMatrix,
    //       false,
    //       mat4.create());
      
    //   gl.activeTexture(gl.TEXTURE0);
    //   gl.bindTexture(gl.TEXTURE_2D, tex);
    //   gl.uniform1i(shader.uniformLocations.uSampler, 0);
      
    //   {
    //     const offset = 0;
    //     const type = gl.UNSIGNED_SHORT;
    //     const vertexCount = 4;
    //     gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    //   }
      
    //   gl.disableVertexAttribArray(shader.attribLocations.vertexPosition);
    //   gl.disableVertexAttribArray(shader.attribLocations.textureCoord);
    // }
    
    {
      // Draw window mask
      let shader = shaders.simple
      
      {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 6 * 4;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, windowBuffer.bufferObj);
        gl.vertexAttribPointer(
            shader.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(shader.attribLocations.vertexPosition);
      }
      
      {
        const numComponents = 4;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 6 * 4;
        const offset = 2 * 4;
        gl.vertexAttribPointer(
            shader.attribLocations.vertexColor,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(shader.attribLocations.vertexColor);
      }

      gl.useProgram(shader.program);
      gl.uniformMatrix4fv(
          shader.uniformLocations.projectionMatrix,
          false,
          proj);
      gl.uniformMatrix4fv(
          shader.uniformLocations.modelViewMatrix,
          false,
          mat4.create());

      {
        const offset = 0;
        const vertexCount = windowBuffer.count;
        gl.drawArrays(gl.TRIANGLES, offset, vertexCount);
      }
      gl.disableVertexAttribArray(shader.attribLocations.vertexPosition);
      gl.disableVertexAttribArray(shader.attribLocations.vertexColor);
    }
    
    let alpha = 1.0;
    if (currentSimState === SimState.MOVE && currentMoveAnim) {
      let t = currentMoveAnim.currentTime / currentMoveAnim.totalTime;
      if (t < 0.25) {
        alpha = 1.0 - (t * 4);
      }
      else {
        alpha = 0;
      }
    }
    
    renderQueue.forEach(entry => {
      let shader = shaders.line;
      // Tell WebGL how to pull out the positions from the position
      // buffer into the vertexPosition attribute
      {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, entry.buffer);
        gl.vertexAttribPointer(
            shader.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(shader.attribLocations.vertexPosition);
      }

      gl.useProgram(shader.program);
      gl.uniformMatrix4fv(
          shader.uniformLocations.projectionMatrix,
          false,
          proj);
      gl.uniformMatrix4fv(
          shader.uniformLocations.modelViewMatrix,
          false,
          entry.modelViewMatrix);
      gl.uniform4fv(
        shader.uniformLocations.vertexColor,
        [1.0, 1.0, 1.0, alpha] // white
      );

      {
        const offset = 0;
        const vertexCount = entry.count;
        gl.drawArrays(gl.LINE_STRIP, offset, vertexCount);
      }
      gl.disableVertexAttribArray(shader.attribLocations.vertexPosition);
    });
    
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
  
  function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Because images have to be download over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  width, height, border, srcFormat, srcType,
                  pixel);

    const image = new Image();
    image.onload = function() {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    srcFormat, srcType, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    };
    image.src = url;

    return texture;
  }
  
  function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
  }
  
  function clamp(val, min, max) {
    return val < min ? min : (val > max ? max : val);
  }
  
  function lerp(start, finish, t) {
    return ((finish - start) * t) + start;
  }
  
  main();
})();