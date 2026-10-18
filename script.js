pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
document.getElementById('year').textContent = new Date().getFullYear();

let activePassportFile = null;
let converterFiles = [];
let pdfFiles = [];
let activeResizeFile = null;
let resizeImgAspectRatio = 1;

// Pomodoro Timer State Variables
let pomoTimerInterval = null;
let pomoCurrentMode = 'pomodoro'; 
let pomoTotalTime = 25 * 60;
let pomoTimeLeft = 25 * 60;
let pomoIsRunning = false;
let pomoSessionsCompleted = 0;

// Background & Crop Studio State Variables
let activeBgFile = null;
let originalImageObj = null;
let cropStartX = 0, cropStartY = 0, cropEndX = 0, cropEndY = 0;
let isCroppingActive = false;
let hasCustomCrop = false;

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-indigo-400', 'bg-indigo-500/10', 'border', 'border-indigo-500/20');
        btn.classList.add('text-slate-400');
    });

    const activeTab = document.getElementById(`tab-${tabId}`);
    if(activeTab) activeTab.classList.remove('hidden');

    const activeNav = document.getElementById(`nav-${tabId}`);
    if(activeNav) {
        activeNav.classList.add('text-indigo-400', 'bg-indigo-500/10', 'border', 'border-indigo-500/20');
        activeNav.classList.remove('text-slate-400');
    }

    if(tabId === 'qr-generator') {
        setTimeout(generateQRCode, 100);
    }

    document.getElementById('mobile-menu').classList.add('hidden');
}

function toggleMobileMenu() {
    document.getElementById('mobile-menu').classList.toggle('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const bgClass = type === 'success' ? 'bg-emerald-600 text-white' : type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-100 border border-slate-700';
    const iconClass = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

    toast.className = `pointer-events-auto flex items-center space-x-2 text-sm px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0 ${bgClass}`;
    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i><span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function setupDragDrop(zoneId, handler) {
    const zone = document.getElementById(zoneId);
    if(!zone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
            e.preventDefault();
            zone.classList.add('drag-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
            e.preventDefault();
            zone.classList.remove('drag-active');
        }, false);
    });

    zone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        handler(dt.files);
    }, false);
}

setupDragDrop('conv-dropzone', handleConverterFiles);
setupDragDrop('pdf-dropzone', handlePdfFiles);
setupDragDrop('bg-dropzone', (files) => { if(files[0]) loadBgImage(files[0]); });
setupDragDrop('passport-dropzone', (files) => { if(files[0]) loadPassportImage(files[0]); });

/* ================= STUNNING POMODORO TIMER LOGIC ================= */
function playChimeSound(type = 'start') {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = 'sine';
        if (type === 'start') {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
        } else {
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.4);
        }

        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        console.log('Audio Context restricted');
    }
}

function setPomodoroMode(mode) {
    clearInterval(pomoTimerInterval);
    pomoIsRunning = false;
    pomoCurrentMode = mode;

    const modeBtn = document.getElementById('pomo-mode-btn');
    const shortBtn = document.getElementById('short-break-btn');
    const longBtn = document.getElementById('long-break-btn');
    const statusLabel = document.getElementById('pomo-status-label');
    const startBtn = document.getElementById('pomo-start-btn');

    modeBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all text-slate-400 hover:text-white";
    shortBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all text-slate-400 hover:text-white";
    longBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all text-slate-400 hover:text-white";

    if (mode === 'pomodoro') {
        pomoTotalTime = 25 * 60;
        modeBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-rose-600 text-white shadow-lg shadow-rose-600/30";
        statusLabel.textContent = "Ready to Focus";
    } else if (mode === 'shortBreak') {
        pomoTotalTime = 5 * 60;
        shortBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-600/30";
        statusLabel.textContent = "Quick Break";
    } else if (mode === 'longBreak') {
        pomoTotalTime = 15 * 60;
        longBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-600/30";
        statusLabel.textContent = "Deep Rest";
    }

    pomoTimeLeft = pomoTotalTime;
    startBtn.innerHTML = '<i class="fa-solid fa-play mr-2"></i> Start Focus Session';
    updatePomodoroDisplay();
}

function updatePomodoroDisplay() {
    const minutes = Math.floor(pomoTimeLeft / 60);
    const seconds = pomoTimeLeft % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    document.getElementById('pomo-timer-display').textContent = formatted;
    document.title = `(${formatted}) FileGenius - Focus Studio`;

    const ring = document.getElementById('pomo-progress-ring');
    const circumference = 276.46; 
    const offset = circumference - (pomoTimeLeft / pomoTotalTime) * circumference;
    if(ring) ring.style.strokeDashoffset = offset;
}

function togglePomodoroTimer() {
    const startBtn = document.getElementById('pomo-start-btn');
    const statusLabel = document.getElementById('pomo-status-label');

    if (pomoIsRunning) {
        clearInterval(pomoTimerInterval);
        pomoIsRunning = false;
        startBtn.innerHTML = '<i class="fa-solid fa-play mr-2"></i> Resume Session';
        statusLabel.textContent = "Paused";
        showToast('Focus session paused', 'info');
    } else {
        if(pomoTimeLeft === pomoTotalTime) {
            playChimeSound('start');
        }
        pomoIsRunning = true;
        startBtn.innerHTML = '<i class="fa-solid fa-pause mr-2"></i> Pause Session';
        statusLabel.textContent = pomoCurrentMode === 'pomodoro' ? "Deep Focus..." : "Resting...";
        showToast('Focus timer started!', 'success');

        pomoTimerInterval = setInterval(() => {
            if (pomoTimeLeft > 0) {
                pomoTimeLeft--;
                updatePomodoroDisplay();
            } else {
                clearInterval(pomoTimerInterval);
                pomoIsRunning = false;
                playChimeSound('end');

                if (pomoCurrentMode === 'pomodoro') {
                    pomoSessionsCompleted++;
                    document.getElementById('pomo-sessions-count').textContent = pomoSessionsCompleted;
                    showToast('Fantastic job! Focus session completed.', 'success');
                } else {
                    showToast('Break finished! Ready to dive back in?', 'info');
                }

                startBtn.innerHTML = '<i class="fa-solid fa-play mr-2"></i> Start Focus Session';
                statusLabel.textContent = "Session Complete";
            }
        }, 1000);
    }
}

function resetPomodoroTimer() {
    clearInterval(pomoTimerInterval);
    pomoIsRunning = false;
    pomoTimeLeft = pomoTotalTime;
    updatePomodoroDisplay();
    document.getElementById('pomo-start-btn').innerHTML = '<i class="fa-solid fa-play mr-2"></i> Start Focus Session';
    document.getElementById('pomo-status-label').textContent = "Ready";
    showToast('Timer reset');
}

/* ================= BACKGROUND REMOVER & CROP LOGIC ================= */
function loadBgImage(file) {
    if(!file || !file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'error');
        return;
    }

    activeBgFile = file;
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
        originalImageObj = img;
        resetCropData();
        
        const canvas = document.getElementById('bg-canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        document.getElementById('bg-workspace').classList.remove('hidden');
        setupCanvasCropListeners(canvas);
        processBgRemoval();
        showToast('Image loaded into Background & Crop Studio!');
    };
    img.src = url;
}

function resetCropData() {
    if (!originalImageObj) return;
    cropStartX = 0;
    cropStartY = 0;
    cropEndX = originalImageObj.width;
    cropEndY = originalImageObj.height;
    hasCustomCrop = false;
}

function resetCrop() {
    if (!originalImageObj) return;
    resetCropData();
    redrawCanvasWithImage(originalImageObj);
    processBgRemoval();
    showToast('Crop selection reset');
}

function setupCanvasCropListeners(canvas) {
    let isMouseDown = false;

    canvas.onmousedown = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        cropStartX = (e.clientX - rect.left) * scaleX;
        cropStartY = (e.clientY - rect.top) * scaleY;
        isMouseDown = true;
        hasCustomCrop = true;
    };

    canvas.onmousemove = (e) => {
        if (!isMouseDown || !originalImageObj) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        cropEndX = (e.clientX - rect.left) * scaleX;
        cropEndY = (e.clientY - rect.top) * scaleY;

        redrawCanvasWithImage(originalImageObj);
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(
            Math.min(cropStartX, cropEndX),
            Math.min(cropStartY, cropEndY),
            Math.abs(cropEndX - cropStartX),
            Math.abs(cropEndY - cropStartY)
        );
        ctx.setLineDash([]);
    };

    canvas.onmouseup = () => {
        isMouseDown = false;
    };
}

function redrawCanvasWithImage(img) {
    const canvas = document.getElementById('bg-canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
}

function applyCrop() {
    if (!originalImageObj || !hasCustomCrop) {
        showToast('Please drag a crop box on the image first', 'error');
        return;
    }

    const x = Math.max(0, Math.min(cropStartX, cropEndX));
    const y = Math.max(0, Math.min(cropStartY, cropEndY));
    const w = Math.min(originalImageObj.width - x, Math.abs(cropEndX - cropStartX));
    const h = Math.min(originalImageObj.height - y, Math.abs(cropEndY - cropStartY));

    if (w < 10 || h < 10) {
        showToast('Selected crop area is too small', 'error');
        return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(originalImageObj, x, y, w, h, 0, 0, w, h);

    const croppedImg = new Image();
    croppedImg.onload = () => {
        originalImageObj = croppedImg;
        resetCropData();
        redrawCanvasWithImage(croppedImg);
        processBgRemoval();
        showToast('Image cropped successfully!', 'success');
    };
    croppedImg.src = tempCanvas.toDataURL('image/png');
}

function processBgRemoval() {
    if(!originalImageObj) return;

    const canvas = document.getElementById('bg-canvas');
    const ctx = canvas.getContext('2d');
    const mode = document.getElementById('bg-mode').value;
    const tolerance = parseInt(document.getElementById('bg-tolerance').value, 10);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImageObj, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    let targetR = 255, targetG = 255, targetB = 255;

    if (mode === 'black') {
        targetR = 0; targetG = 0; targetB = 0;
    } else if (mode === 'corner') {
        targetR = data[0];
        targetG = data[1];
        targetB = data[2];
    }

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (mode === 'white') {
            if (r > (255 - tolerance) && g > (255 - tolerance) && b > (255 - tolerance)) {
                data[i + 3] = 0;
            }
        } else if (mode === 'black') {
            if (r < tolerance && g < tolerance && b < tolerance) {
                data[i + 3] = 0;
            }
        } else if (mode === 'corner') {
            const diff = Math.abs(r - targetR) + Math.abs(g - targetG) + Math.abs(b - targetB);
            if (diff <= tolerance * 3) {
                data[i + 3] = 0;
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

function downloadTransparentPng() {
    const canvas = document.getElementById('bg-canvas');
    if(!canvas) return;

    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'background-removed.png';
        a.click();
        showToast('Transparent PNG downloaded successfully!', 'success');
    }, 'image/png');
}

/* ================= IMAGE CONVERTER LOGIC ================= */
function handleConverterFiles(files) {
    if(!files || files.length === 0) return;

    for(let file of files) {
        if(!file.type.startsWith('image/')) {
            showToast(`${file.name} is not a supported image file`, 'error');
            continue;
        }
        converterFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            file: file,
            convertedUrl: null,
            status: 'pending'
        });
    }

    renderConverterList();
    showToast(`${files.length} file(s) added to converter`);
}

function renderConverterList() {
    const listEl = document.getElementById('conv-file-list');
    const controlsEl = document.getElementById('conv-controls');

    if(converterFiles.length === 0) {
        listEl.innerHTML = '';
        controlsEl.classList.add('hidden');
        return;
    }

    controlsEl.classList.remove('hidden');
    listEl.innerHTML = '';

    converterFiles.forEach((item) => {
        const card = document.createElement('div');
        card.className = "bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4";
        
        const origSize = (item.file.size / 1024).toFixed(1) + ' KB';

        card.innerHTML = `
            <div class="flex items-center space-x-4 w-full sm:w-auto">
                <img src="${URL.createObjectURL(item.file)}" class="w-16 h-16 object-cover rounded-xl border border-slate-800 bg-slate-950 flex-shrink-0">
                <div class="min-w-0 flex-1">
                    <h4 class="font-semibold text-white text-sm truncate max-w-xs">${item.file.name}</h4>
                    <p class="text-xs text-slate-400">Original: ${origSize} | ${item.file.type.split('/')[1].toUpperCase()}</p>
                    <span class="inline-block mt-1 text-xs font-semibold text-slate-400">
                        ${item.status === 'converted' ? '<span class="text-emerald-400"><i class="fa-solid fa-check"></i> Converted</span>' : 'Ready to convert'}
                    </span>
                </div>
            </div>
            <div class="flex items-center space-x-2 w-full sm:w-auto justify-end">
                ${item.convertedUrl ? `
                    <a href="${item.convertedUrl}" download="converted-${item.file.name.split('.')[0]}.${getSelectedExt()}" class="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-semibold transition-all flex items-center">
                        <i class="fa-solid fa-download mr-1"></i> Download
                    </a>
                ` : ''}
                <button onclick="removeConverterFile('${item.id}')" class="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-800">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
        listEl.appendChild(card);
    });
}

function getSelectedExt() {
    const mime = document.getElementById('conv-target-format').value;
    if(mime === 'image/png') return 'png';
    if(mime === 'image/jpeg') return 'jpg';
    if(mime === 'image/webp') return 'webp';
    return 'png';
}

function removeConverterFile(id) {
    converterFiles = converterFiles.filter(item => item.id !== id);
    renderConverterList();
}

function clearConverter() {
    converterFiles = [];
    renderConverterList();
}

function convertAllImages() {
    const targetMime = document.getElementById('conv-target-format').value;
    if(converterFiles.length === 0) return;

    let completed = 0;

    converterFiles.forEach(item => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            if (targetMime === 'image/jpeg') {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                item.convertedUrl = URL.createObjectURL(blob);
                item.status = 'converted';
                completed++;

                if(completed === converterFiles.length) {
                    renderConverterList();
                    showToast('All images converted successfully!', 'success');
                }
            }, targetMime, 0.92);
        };
        img.src = URL.createObjectURL(item.file);
    });
}

/* ================= IMAGE RESIZER LOGIC ================= */
function loadResizeImage(file) {
    if(!file || !file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'error');
        return;
    }

    activeResizeFile = file;
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
        resizeImgAspectRatio = img.width / img.height;
        document.getElementById('resize-width').value = img.width;
        document.getElementById('resize-height').value = img.height;
        document.getElementById('resize-orig-dim').textContent = `${img.width} x ${img.height}`;
        document.getElementById('resize-orig-size').textContent = (file.size / 1024).toFixed(1) + ' KB';
        
        document.getElementById('resize-preview-img').src = url;
        document.getElementById('resize-workspace').classList.remove('hidden');
        showToast('Image loaded into Resizer Studio');
    };
    img.src = url;
}

function handleDimensionChange(changed) {
    const maintain = document.getElementById('resize-aspect-ratio').checked;
    if(!maintain) return;

    const widthInput = document.getElementById('resize-width');
    const heightInput = document.getElementById('resize-height');

    if(changed === 'width') {
        const val = parseFloat(widthInput.value) || 0;
        heightInput.value = Math.round(val / resizeImgAspectRatio);
    } else {
        const val = parseFloat(heightInput.value) || 0;
        widthInput.value = Math.round(val * resizeImgAspectRatio);
    }
}

function processAndDownloadResized() {
    if(!activeResizeFile) return;

    const targetWidth = parseInt(document.getElementById('resize-width').value, 10);
    const targetHeight = parseInt(document.getElementById('resize-height').value, 10);
    const quality = parseInt(document.getElementById('resize-quality').value, 10) / 100;
    const mime = document.getElementById('resize-format').value;

    if(!targetWidth || !targetHeight) {
        showToast('Please enter valid width and height', 'error');
        return;
    }

    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (mime === 'image/jpeg') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        canvas.toBlob((blob) => {
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const ext = mime.split('/')[1];
            a.href = downloadUrl;
            a.download = `resized-image.${ext}`;
            a.click();
            showToast('Resized image downloaded!', 'success');
        }, mime, quality);
    };
    img.src = URL.createObjectURL(activeResizeFile);
}

/* ================= IMAGES TO PDF LOGIC ================= */
function handlePdfFiles(files) {
    if(!files || files.length === 0) return;

    Array.from(files).forEach(file => {
        if(!file.type.startsWith('image/')) {
            showToast(`${file.name} is not a valid image`, 'error');
            return;
        }
        pdfFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            file: file,
            previewUrl: URL.createObjectURL(file)
        });
    });

    renderPdfPreview();
    showToast('Image(s) added to PDF builder');
}

function renderPdfPreview() {
    const grid = document.getElementById('pdf-preview-grid');
    const controls = document.getElementById('pdf-controls');

    if(pdfFiles.length === 0) {
        grid.innerHTML = '';
        controls.classList.add('hidden');
        return;
    }

    controls.classList.remove('hidden');
    grid.innerHTML = '';

    pdfFiles.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = "relative bg-slate-900/80 p-2 rounded-2xl border border-slate-800 shadow-xl group hover:border-emerald-500/40 transition-all";
        card.innerHTML = `
            <div class="absolute top-3 left-3 bg-slate-950/80 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold backdrop-blur-md border border-slate-800">
                Page ${index + 1}
            </div>
            <button onclick="removePdfFile('${item.id}')" class="absolute top-3 right-3 bg-rose-600 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                <i class="fa-solid fa-xmark text-xs"></i>
            </button>
            <img src="${item.previewUrl}" class="w-full h-36 object-cover rounded-xl bg-slate-950 border border-slate-800">
            <div class="mt-2 text-center truncate text-xs text-slate-400 font-medium px-1">
                ${item.file.name}
            </div>
        `;
        grid.appendChild(card);
    });
}

function removePdfFile(id) {
    pdfFiles = pdfFiles.filter(item => item.id !== id);
    renderPdfPreview();
}

function clearPdfList() {
    pdfFiles = [];
    renderPdfPreview();
}

async function generatePDF() {
    if(pdfFiles.length === 0) {
        showToast('Please add at least one image', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const orientation = document.getElementById('pdf-orientation').value;
    const margin = parseInt(document.getElementById('pdf-margin').value, 10);
    let fileName = document.getElementById('pdf-filename').value.trim() || 'compiled-document';

    showToast('Generating PDF document...', 'info');

    const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pdfFiles.length; i++) {
        if (i > 0) pdf.addPage();

        const item = pdfFiles[i];
        const imgData = await getBase64FromUrl(item.previewUrl);

        const imgProps = pdf.getImageProperties(imgData);
        const printableWidth = pageWidth - (margin * 2);
        const printableHeight = pageHeight - (margin * 2);

        let renderWidth = printableWidth;
        let renderHeight = (imgProps.height * renderWidth) / imgProps.width;

        if (renderHeight > printableHeight) {
            renderHeight = printableHeight;
            renderWidth = (imgProps.width * renderHeight) / imgProps.height;
        }

        const xPos = margin + (printableWidth - renderWidth) / 2;
        const yPos = margin + (printableHeight - renderHeight) / 2;

        pdf.addImage(imgData, 'JPEG', xPos, yPos, renderWidth, renderHeight);
    }

    pdf.save(`${fileName}.pdf`);
    showToast('PDF downloaded successfully!', 'success');
}

function getBase64FromUrl(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = error => reject(error);
        img.src = url;
    });
}

/* ================= PDF TO IMAGES LOGIC ================= */
async function renderPdfToImages(file) {
    if(!file || file.type !== 'application/pdf') {
        showToast('Please select a valid PDF file', 'error');
        return;
    }

    const container = document.getElementById('pdf-pages-container');
    container.innerHTML = '<div class="p-8 text-center text-slate-400 font-medium">Processing PDF Pages...</div>';

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        container.innerHTML = '';
        showToast(`Rendering ${pdf.numPages} PDF pages...`);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const imgUrl = canvas.toDataURL('image/png');

            const pageCard = document.createElement('div');
            pageCard.className = "bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4";
            pageCard.innerHTML = `
                <div class="flex items-center space-x-4">
                    <img src="${imgUrl}" class="w-20 h-24 object-cover border border-slate-800 rounded-xl bg-slate-950">
                    <div>
                        <h4 class="font-bold text-white text-sm">Page ${pageNum} of ${pdf.numPages}</h4>
                        <p class="text-xs text-slate-400">${viewport.width} x ${viewport.height} px</p>
                    </div>
                </div>
                <a href="${imgUrl}" download="page-${pageNum}.png" class="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-semibold flex items-center">
                    <i class="fa-solid fa-download mr-1.5"></i> Download PNG
                </a>
            `;
            container.appendChild(pageCard);
        }
    } catch(e) {
        container.innerHTML = '<div class="p-4 text-center text-rose-500 text-sm">Failed to render PDF file.</div>';
        showToast('Error reading PDF file', 'error');
    }
}

/* ================= TEXT & JSON LOGIC ================= */
function analyzeText() {
    const val = document.getElementById('text-input').value;
    document.getElementById('stat-chars').textContent = val.length;
    document.getElementById('stat-words').textContent = val.trim() ? val.trim().split(/\s+/).length : 0;
    document.getElementById('stat-lines').textContent = val ? val.split('\n').length : 0;

    const jsonStat = document.getElementById('stat-json');
    if(!val.trim()) {
        jsonStat.textContent = 'Not Evaluated';
        jsonStat.className = 'text-xs font-bold text-slate-500';
        return;
    }

    try {
        JSON.parse(val);
        jsonStat.textContent = 'Valid JSON';
        jsonStat.className = 'text-xs font-bold text-emerald-400';
    } catch(e) {
        jsonStat.textContent = 'Invalid JSON';
        jsonStat.className = 'text-xs font-bold text-rose-400';
    }
}

function transformCase(mode) {
    const textarea = document.getElementById('text-input');
    let val = textarea.value;

    if(mode === 'upper') val = val.toUpperCase();
    if(mode === 'lower') val = val.toLowerCase();
    if(mode === 'title') {
        val = val.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    }

    textarea.value = val;
    analyzeText();
    showToast(`Converted text to ${mode}case`);
}

function formatJSON() {
    const textarea = document.getElementById('text-input');
    try {
        const parsed = JSON.parse(textarea.value);
        textarea.value = JSON.stringify(parsed, null, 2);
        analyzeText();
        showToast('Formatted JSON successfully!', 'success');
    } catch(e) {
        showToast('Cannot format: Invalid JSON text', 'error');
    }
}

function copyTextContent() {
    const textarea = document.getElementById('text-input');
    if(!textarea.value) return;

    textarea.select();
    document.execCommand('copy');
    showToast('Text copied to clipboard!', 'success');
}

/* ================= QR CODE LOGIC ================= */
function generateQRCode() {
    const container = document.getElementById('qrcode-box');
    container.innerHTML = '';

    const text = document.getElementById('qr-text').value.trim() || 'https://github.com';
    const fg = document.getElementById('qr-fg').value;
    const bg = document.getElementById('qr-bg').value;

    new QRCode(container, {
        text: text,
        width: 180,
        height: 180,
        colorDark: fg,
        colorLight: bg,
        correctLevel: QRCode.CorrectLevel.H
    });
}

function downloadQRCode() {
    const img = document.querySelector('#qrcode-box img');
    if(!img) return;

    const a = document.createElement('a');
    a.href = img.src;
    a.download = 'qrcode.png';
    a.click();
    showToast('QR Code downloaded!', 'success');
}




















/* ================= AI-POWERED PASSPORT PHOTO MAKER LOGIC ================= */
let passportImageObj = null;
let passportBgColor = '#ffffff';
let pCropStartX = 0, pCropStartY = 0, pCropEndX = 0, pCropEndY = 0;
let pHasCrop = false;
let selfieSegmentation = null;

// Initialize MediaPipe AI Model on load
async function initPassportAI() {
    try {
        selfieSegmentation = new SelfieSegmentation({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });
        selfieSegmentation.setOptions({
            modelSelection: 1, // 1 = General landscape/portrait model (higher accuracy)
        });
        selfieSegmentation.onResults(onAIResults);
    } catch (e) {
        console.log('AI Model initialization failed, falling back to canvas mode.');
    }
}
initPassportAI();

setupDragDrop('passport-dropzone', (files) => { if(files[0]) loadPassportImage(files[0]); });

function loadPassportImage(file) {
    if(!file || !file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'error');
        return;
    }
    activePassportFile = file;
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
        passportImageObj = img;
        resetPassportCropData();
        document.getElementById('passport-workspace').classList.remove('hidden');
        redrawPassportCanvas(img);
        setupPassportCropListeners();
        processPassportAI();
        showToast('AI loaded photo into Passport Studio!');
    };
    img.src = url;
}

function resetPassportCropData() {
    if (!passportImageObj) return;
    pCropStartX = 0;
    pCropStartY = 0;
    pCropEndX = passportImageObj.width;
    pCropEndY = passportImageObj.height;
    pHasCrop = false;
}

function resetPassportCrop() {
    if (!passportImageObj) return;
    resetPassportCropData();
    redrawPassportCanvas(passportImageObj);
    processPassportAI();
    showToast('Crop reset');
}

function redrawPassportCanvas(img) {
    const canvas = document.getElementById('passport-canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
}

function setupPassportCropListeners() {
    const canvas = document.getElementById('passport-canvas');
    let isMouseDown = false;

    canvas.onmousedown = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        pCropStartX = (e.clientX - rect.left) * scaleX;
        pCropStartY = (e.clientY - rect.top) * scaleY;
        isMouseDown = true;
        pHasCrop = true;
    };

    canvas.onmousemove = (e) => {
        if (!isMouseDown || !passportImageObj) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        pCropEndX = (e.clientX - rect.left) * scaleX;
        pCropEndY = (e.clientY - rect.top) * scaleY;

        redrawPassportCanvas(passportImageObj);
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(
            Math.min(pCropStartX, pCropEndX),
            Math.min(pCropStartY, pCropEndY),
            Math.abs(pCropEndX - pCropStartX),
            Math.abs(pCropEndY - pCropStartY)
        );
        ctx.setLineDash([]);
    };

    canvas.onmouseup = () => { isMouseDown = false; };
}

function applyPassportCrop() {
    if (!passportImageObj || !pHasCrop) {
        showToast('Please drag a crop box over the face first', 'error');
        return;
    }

    const x = Math.max(0, Math.min(pCropStartX, pCropEndX));
    const y = Math.max(0, Math.min(pCropStartY, pCropEndY));
    const w = Math.min(passportImageObj.width - x, Math.abs(pCropEndX - pCropStartX));
    const h = Math.min(passportImageObj.height - y, Math.abs(pCropEndY - pCropStartY));

    if (w < 20 || h < 20) {
        showToast('Selected area too small', 'error');
        return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(passportImageObj, x, y, w, h, 0, 0, w, h);

    const croppedImg = new Image();
    croppedImg.onload = () => {
        passportImageObj = croppedImg;
        resetPassportCropData();
        redrawPassportCanvas(croppedImg);
        processPassportAI();
        showToast('Face cropped & AI background processed!', 'success');
    };
    croppedImg.src = tempCanvas.toDataURL('image/png');
}

function setPassportBg(color, btn) {
    passportBgColor = color;
    document.querySelectorAll('.passport-bg-btn').forEach(b => {
        b.classList.remove('border-cyan-500', 'border-2');
        b.classList.add('border-2', 'border-transparent');
    });
    btn.classList.remove('border-transparent');
    btn.classList.add('border-cyan-500', 'border-2');
    processPassportAI();
}

async function processPassportAI() {
    if (!passportImageObj) return;
    if (!selfieSegmentation) {
        showToast('AI model still loading, please wait...', 'info');
        return;
    }

    showToast('AI removing background...', 'info');
    await selfieSegmentation.send({ image: passportImageObj });
}

function onAIResults(results) {
    const canvas = document.getElementById('passport-canvas');
    const ctx = canvas.getContext('2d');
    const dimensionType = document.getElementById('passport-dimension').value;

    let targetWidth = 413;  // 3.5 cm (India/Europe)
    let targetHeight = 531; // 4.5 cm
    if (dimensionType === 'us') {
        targetWidth = 600;  // 2x2 inches
        targetHeight = 600;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Selected Background Color
    ctx.fillStyle = passportBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Person Mask (AI cutout)
    ctx.globalCompositeOperation = 'source-over';
    
    // Scale and center the image to passport size
    const hRatio = canvas.width / passportImageObj.width;
    const vRatio = canvas.height / passportImageObj.height;
    const ratio = Math.max(hRatio, vRatio);
    const centerShiftX = (canvas.width - passportImageObj.width * ratio) / 2;
    const centerShiftY = (canvas.height - passportImageObj.height * ratio) / 2;

    // Create temporary canvas for masking
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = passportImageObj.width;
    tempCanvas.height = passportImageObj.height;
    const tCtx = tempCanvas.getContext('2d');

    // Draw AI segmentation mask
    tCtx.drawImage(results.segmentationMask, 0, 0, tempCanvas.width, tempCanvas.height);
    tCtx.globalCompositeOperation = 'source-in';
    tCtx.drawImage(passportImageObj, 0, 0, tempCanvas.width, tempCanvas.height);

    // Draw masked person onto main passport canvas
    ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, centerShiftX, centerShiftY, passportImageObj.width * ratio, passportImageObj.height * ratio);
    ctx.restore();

    showToast('AI Passport Photo ready!', 'success');
}

function downloadPassportPhoto() {
    const canvas = document.getElementById('passport-canvas');
    if(!canvas) return;

    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai-passport-photo.png';
        a.click();
        showToast('AI Passport photo downloaded!', 'success');
    }, 'image/png');
}
