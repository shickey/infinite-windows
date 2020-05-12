(function() {

let canvas = document.getElementById('editor');
let ctx = canvas.getContext('2d');

let editorControls = document.getElementById('editor-controls');
let discardButton = document.getElementById('discard-button');
let sendButton = document.getElementById('send-button');

let submitPanel = document.getElementById('submit-panel-container');
let captionField = document.getElementById('caption');
let locationField = document.getElementById('location');
let cancelButton = document.getElementById('cancel-button');
let submitButton = document.getElementById('submit-button');

let path = [];
let drawing = false;
let drawingExists = false;

let backgroundColor = '#000';
let penColor = '#fff';

ctx.lineWidth = 1.0;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

discardButton.addEventListener('click', function(e) {
  if (drawingExists) {
    path = [];
    drawingExists = false;
    disableFooterButtons();
  }
});

sendButton.addEventListener('click', function(e) {
  if (drawingExists) {
    showSubmitPanel();
  }
});

cancelButton.addEventListener('click', function(e) {
  hideSubmitPanel();
});

submitButton.addEventListener('click', function(e) {
  submitDrawing();
});

function disableFooterButtons() {
  sendButton.disabled = true;
  discardButton.disabled = true;
}

function enableFooterButtons() {
  sendButton.disabled = false;
  discardButton.disabled = false;
}

function showSubmitPanel() {
  captionField.value = '';
  locationField.value = '';
  submitPanel.classList.remove('hidden');
}

function hideSubmitPanel() {
  submitPanel.classList.add('hidden');
}

function submitDrawing() {
  if (drawingExists) {
    // Normalize the color representations
    ctx.fillStyle = backgroundColor;
    let background = ctx.fillStyle;
    ctx.fillStyle = penColor;
    let pen = ctx.fillStyle;
    
    drawingsRef.push({
      points: path,
      backgroundColor: background,
      penColor: pen,
      caption: captionField.value,
      location: locationField.value
    });
    
    path = [];
    drawingExists = false;
    hideSubmitPanel();
    disableFooterButtons();
  }
}

function distSq(x1, y1, x2, y2) {
  return ((x2 - x1) * (x2 - x1)) + ((y2 - y1) * (y2 - y1));
}
  
function mouseDown(e) {
  e.preventDefault();
  e.stopPropagation();
  if (drawingExists) { return; }
  let scale = DRAWING_CANVAS_WIDTH / canvas.clientWidth;
  var rect = e.target.getBoundingClientRect();
  let x = (e.clientX - rect.left) * scale;
  let y = (e.clientY - rect.top) * scale;
  
  if (!drawing) {
    // Check for color selection
    let didSelectColor = false;
    if (y <= 20) {
      if (x < 180) {
        let idx = Math.floor(x / 20);
        if (idx === 0) {
          backgroundColor = '#000';
        }
        else {
          backgroundColor = `hsl(${Math.floor((idx - 1) * (360 / 8))}deg, 55%, 20%)`;
        }
        didSelectColor = true;
      }
      else if (x >= DRAWING_CANVAS_WIDTH - 180) {
        let idx = Math.floor((x - (DRAWING_CANVAS_WIDTH - 180)) / 20);
        if (idx === 8) {
          penColor = '#fff';
        }
        else {
          penColor = `hsl(${Math.floor(idx * (360 / 8))}deg, 55%, 65%)`;
        }
        didSelectColor = true;
      }
    }
    
    if (!didSelectColor) {
      // Begin drawing
      drawing = true;
      path = [x, y];
    }
  }
};

function mouseMove(e) {
  e.preventDefault();
  e.stopPropagation();
  let scale = DRAWING_CANVAS_WIDTH / canvas.clientWidth;
  var rect = e.target.getBoundingClientRect();
  let x = (e.clientX - rect.left) * scale;
  let y = (e.clientY - rect.top) * scale;
  if (drawing) {
    path.push(x, y);
  }
};

function mouseUp(e) {
  e.preventDefault();
  e.stopPropagation();
  if (drawing) {
    drawing = false;
    drawingExists = true;
    enableFooterButtons();
  }
};

canvas.addEventListener('mousedown', mouseDown);
canvas.addEventListener('mousemove', mouseMove);
canvas.addEventListener('mouseup', mouseUp);

canvas.addEventListener('touchstart', function(e) {
  var touch = e.touches[0];
  var mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
}, false);

canvas.addEventListener('touchmove', function(e) {
  var touch = e.touches[0];
  var mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
}, false);

canvas.addEventListener('touchend', function(e) {
  var mouseEvent = new MouseEvent('mouseup', {});
  canvas.dispatchEvent(mouseEvent);
}, false);

function draw() {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT);
  
  if (!drawing && !drawingExists) {
    // Background color selection
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 20, 20);
    for (let i = 0; i < 8; ++i) {
      ctx.fillStyle = `hsl(${Math.floor(i * (360 / 8))}deg, 55%, 20%)`
      ctx.fillRect((i * 20) + 20, 0, 20, 20);
    }
    
    
    // Pen color selection
    for (let i = 0; i < 8; ++i) {
      ctx.fillStyle = `hsl(${Math.floor(i * (360 / 8))}deg, 55%, 65%)`
      ctx.fillRect((DRAWING_CANVAS_WIDTH - 180) + (i * 20), 0, 20, 20);
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect((DRAWING_CANVAS_WIDTH - 20), 0, 20, 20);
    
    ctx.fillText('background color', 10, 35);
    ctx.fillText('drawing color', (DRAWING_CANVAS_WIDTH - 65), 35);
  }
  
  ctx.fillStyle = penColor;
  ctx.strokeStyle = penColor;
  
  if (path.length > 1) {
    ctx.beginPath();
    for (let i = 0; i < path.length; i += 2) {
      if (i == 0) {
        ctx.moveTo(path[0], path[1]);
      }
      else {
        ctx.lineTo(path[i], path[i + 1]);
      }
    }
    ctx.stroke();
  }
  
  if (!drawing) {
    if (!drawingExists) {
      ctx.fillText('look out your window', 155, 170);
      ctx.fillText('click anywhere to start drawing what you see', 105, 190);
    }
  }
  else {
    ctx.fillText('click here to stop drawing', 480, 150);
  }
  
  window.requestAnimationFrame(draw);
}

window.requestAnimationFrame(draw);

})();