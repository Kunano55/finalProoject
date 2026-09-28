document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const dropzonePrompt = document.getElementById('dropzonePrompt');
    const videoInput = document.getElementById('videoInput');
    const previewWrapper = document.getElementById('previewWrapper');
    const videoPreview = document.getElementById('videoPreview');
    const btnRemoveVideo = document.getElementById('btnRemoveVideo');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const fileSizeDisplay = document.getElementById('fileSizeDisplay');
    const btnAnalyze = document.getElementById('btnAnalyze');

    const processingCard = document.getElementById('processingCard');
    const statusHeading = document.getElementById('statusHeading');
    const statusDetail = document.getElementById('statusDetail');

    const emptyResults = document.getElementById('emptyResults');
    const resultsContent = document.getElementById('resultsContent');
    const verdictBanner = document.getElementById('verdictBanner');
    const verdictTitle = document.getElementById('verdictTitle');
    const verdictDesc = document.getElementById('verdictDesc');
    const confidenceValue = document.getElementById('confidenceValue');

    const modelRankingList = document.getElementById('modelRankingList');

    const metaDuration = document.getElementById('metaDuration');
    const metaResolution = document.getElementById('metaResolution');
    const metaAnalyzedFrames = document.getElementById('metaAnalyzedFrames');
    const metaModel = document.getElementById('metaModel');
    const framesGrid = document.getElementById('framesGrid');

    let selectedFile = null;

    // Handle Dropzone Click
    dropzone.addEventListener('click', (e) => {
        if (e.target.closest('#btnRemoveVideo') || e.target.closest('video')) return;
        videoInput.click();
    });

    // Drag & Drop events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    videoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Remove video
    btnRemoveVideo.addEventListener('click', (e) => {
        e.stopPropagation();
        resetFileInput();
    });

    function resetFileInput() {
        selectedFile = null;
        videoInput.value = '';
        videoPreview.src = '';
        previewWrapper.style.display = 'none';
        dropzonePrompt.style.display = 'block';
        btnAnalyze.disabled = true;
        
        // Reset Right Panel
        resultsContent.style.display = 'none';
        emptyResults.style.display = 'flex';
    }

    function handleFileSelect(file) {
        const validExtensions = ['.mp4', '.avi', '.mov', '.webm'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        if (!validExtensions.includes(ext)) {
            alert('กรุณาเลือกไฟล์วิดีโอที่มีนามสกุล .mp4, .avi, .mov หรือ .webm เท่านั้น');
            return;
        }

        const maxSize = 120 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('ขนาดไฟล์เกิน 120MB กรุณาเลือกไฟล์ที่มีขนาดเล็กลง');
            return;
        }

        selectedFile = file;

        // Display info
        fileNameDisplay.innerHTML = `<i class="fa-solid fa-file-video"></i> ${file.name}`;
        fileSizeDisplay.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

        // Preview video
        const url = URL.createObjectURL(file);
        videoPreview.src = url;
        dropzonePrompt.style.display = 'none';
        previewWrapper.style.display = 'block';
        btnAnalyze.disabled = false;

        // Ensure Results panel is reset to empty state on new file selection
        resultsContent.style.display = 'none';
        emptyResults.style.display = 'flex';
    }

    // Handle Analysis Submit
    btnAnalyze.addEventListener('click', async () => {
        if (!selectedFile) return;

        // Reset & Show Loading UI
        btnAnalyze.disabled = true;
        processingCard.style.display = 'flex';
        emptyResults.style.display = 'flex';
        resultsContent.style.display = 'none';

        updateStepTracker(1);
        statusHeading.textContent = 'กำลังอัปโหลดวิดีโอ...';
        statusDetail.textContent = 'ส่งไฟล์วิดีโอไปยังเครื่องประมวลผล';

        const formData = new FormData();
        formData.append('video', selectedFile);

        try {
            setTimeout(() => {
                updateStepTracker(2);
                statusHeading.textContent = 'กำลังสกัดเฟรมและตัดใบหน้าด้วย MTCNN...';
                statusDetail.textContent = 'ตรวจจับตำแหน่งใบหน้าสำคัญและสกัดพิกัดข้ามเฟรม';
            }, 1000);

            setTimeout(() => {
                updateStepTracker(3);
                statusHeading.textContent = 'กำลังวิเคราะห์ด้วย Xception AI Model...';
                statusDetail.textContent = 'คำนวณลักษณะเฉพาะข้ามช่องสีระดับ Depthwise Separable';
            }, 2500);

            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'เกิดข้อผิดพลาดในการประมวลผล');
            }

            updateStepTracker(4);
            statusHeading.textContent = 'ประมวลผลเสร็จสิ้น!';
            statusDetail.textContent = 'กำลังแสดงรายงานผล...';

            setTimeout(() => {
                processingCard.style.display = 'none';
                displayResults(data);
                btnAnalyze.disabled = false;
            }, 500);

        } catch (err) {
            console.error(err);
            processingCard.style.display = 'none';
            btnAnalyze.disabled = false;
            emptyResults.style.display = 'flex';
            resultsContent.style.display = 'none';
            alert(`เกิดข้อผิดพลาดในการวิเคราะห์: ${err.message}`);
        }
    });

    function updateStepTracker(activeStep) {
        for (let i = 1; i <= 4; i++) {
            const stepEl = document.getElementById(`step${i}`);
            if (i <= activeStep) {
                stepEl.classList.add('active');
            } else {
                stepEl.classList.remove('active');
            }
        }
    }

    function displayResults(data) {
        emptyResults.style.display = 'none';
        resultsContent.style.display = 'flex';

        const isFake = data.is_fake;

        // Verdict Banner Color & Text
        verdictBanner.className = `verdict-banner ${isFake ? 'fake' : 'real'}`;
        if (isFake) {
            verdictTitle.textContent = 'DEEPFAKE DETECTED';
            verdictDesc.textContent = `ระบบตรวจพบร่องรอยการปลอมแปลงใบหน้าในวิดีโอนี้ (${data.confidence.toFixed(1)}% Confidence)`;
        } else {
            verdictTitle.textContent = 'REAL VIDEO';
            verdictDesc.textContent = `วิดีโอนี้มีความน่าเชื่อถือว่าเป็นวิดีโอจริง ไม่พบร่องรอยการปลอมแปลง (${data.confidence.toFixed(1)}% Confidence)`;
        }

        confidenceValue.textContent = `${data.confidence.toFixed(1)}%`;

        // Per-Model Ranking (sorted by real_pct descending from server)
        modelRankingList.innerHTML = '';
        if (data.model_results && data.model_results.length > 0) {
            // Sort by the dominant percentage descending
            // Server already sorts by real_pct desc, but we want to sort by
            // the "confidence" value (whichever is higher: real or fake) desc
            const sorted = [...data.model_results].sort((a, b) => {
                const aConf = Math.max(a.real_pct, a.fake_pct);
                const bConf = Math.max(b.real_pct, b.fake_pct);
                return bConf - aConf;
            });

            sorted.forEach((model, index) => {
                const row = document.createElement('div');
                row.className = `model-rank-row ${model.is_fake ? 'model-fake' : 'model-real'}`;
                row.style.animationDelay = `${index * 0.1}s`;

                const rankNum = index + 1;
                const dominant = model.is_fake ? 'Fake' : 'Real';
                const dominantPct = model.is_fake ? model.fake_pct : model.real_pct;
                const colorClass = model.is_fake ? 'text-fake' : 'text-real';
                const fillClass = model.is_fake ? 'fill-fake' : 'fill-real';

                row.innerHTML = `
                    <div class="rank-number">#${rankNum}</div>
                    <div class="rank-info">
                        <div class="rank-model-name">${model.name}</div>
                        <div class="rank-detail">
                            <span class="text-real">Real ${model.real_pct}%</span>
                            <span class="rank-separator">|</span>
                            <span class="text-fake">Fake ${model.fake_pct}%</span>
                        </div>
                    </div>
                    <div class="rank-bar-wrapper">
                        <div class="meter-bar-bg">
                            <div class="meter-bar-fill ${fillClass}" style="width: 0%;"></div>
                        </div>
                    </div>
                    <div class="rank-pct ${colorClass}">${dominantPct}%</div>
                `;

                modelRankingList.appendChild(row);

                // Animate bar
                setTimeout(() => {
                    const bar = row.querySelector('.meter-bar-fill');
                    bar.style.width = `${dominantPct}%`;
                }, 100 + index * 100);
            });
        }

        // Metadata
        metaDuration.textContent = data.video_info.duration;
        metaResolution.textContent = data.video_info.resolution;
        metaAnalyzedFrames.textContent = `${data.video_info.analyzed_frames} เฟรม`;
        metaModel.textContent = 'ENSEMBLE';

        // Frames Grid (if element exists)
        if (framesGrid) {
            framesGrid.innerHTML = '';
            if (data.frames && data.frames.length > 0) {
                data.frames.forEach((frame) => {
                    const card = document.createElement('div');
                    card.className = 'frame-card';
                    const badgeClass = frame.is_fake ? 'fake' : 'real';
                    const badgeText = frame.is_fake ? `Fake ${frame.fake_pct}%` : `Real ${frame.real_pct}%`;

                    card.innerHTML = `
                        <img src="${frame.thumbnail_url}" alt="Extracted Face" loading="lazy">
                        <div class="frame-info">
                            <span class="frame-time"><i class="fa-solid fa-clock"></i> ${frame.timestamp}</span>
                            <span class="frame-badge ${badgeClass}">${badgeText}</span>
                        </div>
                    `;
                    framesGrid.appendChild(card);
                });
            }
        }
    }
});
