document.addEventListener('DOMContentLoaded', () => {
    // ─── DOM Elements ──────────────────────────────────────────────
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginErrorText = document.getElementById('loginErrorText');
    const btnLogout = document.getElementById('btnLogout');

    // Stats
    const statTotalUploads = document.getElementById('statTotalUploads');
    const statTotalFake = document.getElementById('statTotalFake');
    const statTotalReal = document.getElementById('statTotalReal');
    const statFakePct = document.getElementById('statFakePct');
    const statRealPct = document.getElementById('statRealPct');
    const statActiveModels = document.getElementById('statActiveModels');

    // Charts
    const donutCanvas = document.getElementById('donutChart');
    const barCanvas = document.getElementById('barChart');
    const donutTotal = document.getElementById('donutTotal');
    const legendReal = document.getElementById('legendReal');
    const legendFake = document.getElementById('legendFake');

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabModels = document.getElementById('tabModels');
    const tabHistory = document.getElementById('tabHistory');

    // Models
    const modelsGrid = document.getElementById('modelsGrid');
    const btnOpenAddModel = document.getElementById('btnOpenAddModel');
    const addModelModal = document.getElementById('addModelModal');
    const addModelForm = document.getElementById('addModelForm');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelModal = document.getElementById('btnCancelModal');
    const modelDropzone = document.getElementById('modelDropzone');
    const modelFileInput = document.getElementById('modelFileInput');
    const modelDropPrompt = document.getElementById('modelDropPrompt');
    const modelFileInfo = document.getElementById('modelFileInfo');
    const modelFileName = document.getElementById('modelFileName');
    const modelFileSize = document.getElementById('modelFileSize');
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadProgressFill = document.getElementById('uploadProgressFill');
    const uploadProgressText = document.getElementById('uploadProgressText');

    // Delete modal
    const deleteModal = document.getElementById('deleteModal');
    const deleteModelName = document.getElementById('deleteModelName');
    const btnCloseDeleteModal = document.getElementById('btnCloseDeleteModal');
    const btnCancelDelete = document.getElementById('btnCancelDelete');
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');

    // History
    const historyBody = document.getElementById('historyBody');
    const emptyHistory = document.getElementById('emptyHistory');

    let selectedModelFile = null;
    let deleteTargetKey = null;

    // ─── Check auth on load ────────────────────────────────────────
    checkAuth();

    async function checkAuth() {
        try {
            const res = await fetch('/api/admin/check');
            const data = await res.json();
            if (data.logged_in) {
                showDashboard();
            } else {
                showLogin();
            }
        } catch {
            showLogin();
        }
    }

    function showLogin() {
        loginScreen.style.display = 'flex';
        dashboardScreen.style.display = 'none';
        btnLogout.style.display = 'none';
    }

    function showDashboard() {
        loginScreen.style.display = 'none';
        dashboardScreen.style.display = 'flex';
        btnLogout.style.display = 'flex';
        loadStats();
        loadModels();
        loadHistory();
    }

    // ─── Login ─────────────────────────────────────────────────────
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';

        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                showDashboard();
            } else {
                loginErrorText.textContent = data.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
                loginError.style.display = 'flex';
            }
        } catch (err) {
            loginErrorText.textContent = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
            loginError.style.display = 'flex';
        }
    });

    // ─── Logout ────────────────────────────────────────────────────
    btnLogout.addEventListener('click', async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        showLogin();
    });

    // ─── Tabs ──────────────────────────────────────────────────────
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.tab;
            if (tab === 'models') {
                tabModels.style.display = 'block';
                tabHistory.style.display = 'none';
            } else {
                tabModels.style.display = 'none';
                tabHistory.style.display = 'block';
            }
        });
    });

    // ─── Load Stats ────────────────────────────────────────────────
    async function loadStats() {
        try {
            const res = await fetch('/api/admin/stats');
            if (!res.ok) return;
            const data = await res.json();

            animateCount(statTotalUploads, data.total_uploads);
            animateCount(statTotalFake, data.total_fake);
            animateCount(statTotalReal, data.total_real);
            statFakePct.textContent = `${data.fake_pct}%`;
            statRealPct.textContent = `${data.real_pct}%`;
            animateCount(statActiveModels, data.active_models);

            // Donut
            donutTotal.textContent = data.total_uploads;
            legendReal.textContent = data.total_real;
            legendFake.textContent = data.total_fake;
            drawDonut(data.total_real, data.total_fake);

            // Bar chart
            drawBarChart(data.daily_trend || []);
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    }

    function animateCount(el, target) {
        let current = 0;
        const step = Math.max(1, Math.ceil(target / 30));
        const interval = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(interval);
            }
            el.textContent = current;
        }, 20);
    }

    // ─── Donut Chart (Canvas) ──────────────────────────────────────
    function drawDonut(real, fake) {
        const ctx = donutCanvas.getContext('2d');
        const w = donutCanvas.width;
        const h = donutCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) / 2 - 10;
        const lineWidth = 28;
        const total = real + fake;

        ctx.clearRect(0, 0, w, h);

        if (total === 0) {
            // Empty state
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            return;
        }

        const realAngle = (real / total) * Math.PI * 2;
        const fakeAngle = (fake / total) * Math.PI * 2;
        let startAngle = -Math.PI / 2;

        // Real arc
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + realAngle);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
        startAngle += realAngle;

        // Fake arc
        if (fake > 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, startAngle + fakeAngle);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    // ─── Bar Chart (Canvas) ────────────────────────────────────────
    function drawBarChart(trend) {
        const ctx = barCanvas.getContext('2d');
        const w = barCanvas.width;
        const h = barCanvas.height;
        const padding = { top: 20, right: 20, bottom: 40, left: 40 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);

        if (!trend || trend.length === 0) return;

        const maxVal = Math.max(1, ...trend.map(d => d.uploads));
        const barGroupWidth = chartW / trend.length;
        const barWidth = barGroupWidth * 0.25;
        const gap = 3;

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            // Y labels
            ctx.fillStyle = '#64748b';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'right';
            const val = Math.round(maxVal - (maxVal / 4) * i);
            ctx.fillText(val, padding.left - 6, y + 4);
        }

        trend.forEach((d, i) => {
            const x = padding.left + barGroupWidth * i + barGroupWidth * 0.15;
            const baseY = padding.top + chartH;

            // Real bar
            const realH = (d.real / maxVal) * chartH;
            ctx.fillStyle = '#10b981';
            roundedRect(ctx, x, baseY - realH, barWidth, realH, 3);

            // Fake bar
            const fakeH = (d.fake / maxVal) * chartH;
            ctx.fillStyle = '#ef4444';
            roundedRect(ctx, x + barWidth + gap, baseY - fakeH, barWidth, fakeH, 3);

            // Date label
            ctx.fillStyle = '#64748b';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            const dateLabel = d.date.substring(5); // MM-DD
            ctx.fillText(dateLabel, x + barWidth + gap / 2, baseY + 16);
        });
    }

    function roundedRect(ctx, x, y, w, h, r) {
        if (h <= 0) return;
        r = Math.min(r, h / 2, w / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
    }

    // ─── Load Models ───────────────────────────────────────────────
    async function loadModels() {
        try {
            const res = await fetch('/api/admin/models');
            if (!res.ok) return;
            const data = await res.json();
            renderModels(data.models || []);
        } catch (err) {
            console.error('Failed to load models:', err);
        }
    }

    function renderModels(models) {
        modelsGrid.innerHTML = '';
        if (models.length === 0) {
            modelsGrid.innerHTML = `
                <div class="empty-models">
                    <i class="fa-solid fa-brain"></i>
                    <p>ยังไม่มีโมเดลในระบบ</p>
                </div>
            `;
            return;
        }

        models.forEach((m, index) => {
            const card = document.createElement('div');
            card.className = `model-card ${m.is_active ? 'active' : 'inactive'}`;
            card.style.animationDelay = `${index * 0.05}s`;

            const statusClass = m.is_active ? 'status-active' : 'status-inactive';
            const statusText = m.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
            const statusIcon = m.is_active ? 'fa-circle-check' : 'fa-circle-xmark';
            const fileStatus = m.file_exists
                ? `<span class="file-ok"><i class="fa-solid fa-check"></i> ไฟล์พร้อม</span>`
                : `<span class="file-missing"><i class="fa-solid fa-xmark"></i> ไม่พบไฟล์</span>`;

            card.innerHTML = `
                <div class="model-card-header">
                    <div class="model-icon"><i class="fa-solid fa-microchip"></i></div>
                    <div class="model-meta">
                        <h4>${m.name}</h4>
                        <span class="model-key">${m.key}</span>
                    </div>
                    <span class="model-status ${statusClass}">
                        <i class="fa-solid ${statusIcon}"></i> ${statusText}
                    </span>
                </div>
                <div class="model-card-body">
                    <div class="model-detail">
                        <span><i class="fa-solid fa-file"></i> ${m.filename}</span>
                        <span><i class="fa-solid fa-weight-hanging"></i> ${m.file_size_mb} MB</span>
                    </div>
                    ${m.description ? `<p class="model-desc">${m.description}</p>` : ''}
                    ${fileStatus}
                </div>
                <div class="model-card-actions">
                    <button class="btn-toggle ${m.is_active ? 'on' : 'off'}" data-key="${m.key}" title="${m.is_active ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}">
                        <i class="fa-solid ${m.is_active ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                        ${m.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button class="btn-delete-model" data-key="${m.key}" data-name="${m.name}" title="ลบโมเดล">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            modelsGrid.appendChild(card);
        });

        // Bind toggle buttons
        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', async () => {
                const key = btn.dataset.key;
                try {
                    const res = await fetch(`/api/admin/models/${key}/toggle`, { method: 'PATCH' });
                    if (res.ok) {
                        loadModels();
                        loadStats();
                    }
                } catch (err) {
                    alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะโมเดล');
                }
            });
        });

        // Bind delete buttons
        document.querySelectorAll('.btn-delete-model').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteTargetKey = btn.dataset.key;
                deleteModelName.textContent = btn.dataset.name;
                deleteModal.style.display = 'flex';
            });
        });
    }

    // ─── Delete Model ──────────────────────────────────────────────
    btnConfirmDelete.addEventListener('click', async () => {
        if (!deleteTargetKey) return;
        try {
            const res = await fetch(`/api/admin/models/${deleteTargetKey}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                deleteModal.style.display = 'none';
                loadModels();
                loadStats();
            } else {
                alert(data.error || 'ไม่สามารถลบโมเดลได้');
            }
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการลบโมเดล');
        }
    });

    btnCloseDeleteModal.addEventListener('click', () => { deleteModal.style.display = 'none'; });
    btnCancelDelete.addEventListener('click', () => { deleteModal.style.display = 'none'; });

    // ─── Add Model Modal ───────────────────────────────────────────
    btnOpenAddModel.addEventListener('click', () => {
        addModelForm.reset();
        selectedModelFile = null;
        modelDropPrompt.style.display = 'flex';
        modelFileInfo.style.display = 'none';
        uploadProgress.style.display = 'none';
        addModelModal.style.display = 'flex';
    });

    btnCloseModal.addEventListener('click', () => { addModelModal.style.display = 'none'; });
    btnCancelModal.addEventListener('click', () => { addModelModal.style.display = 'none'; });

    // Model file dropzone
    modelDropzone.addEventListener('click', () => { modelFileInput.click(); });

    modelDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        modelDropzone.classList.add('dragover');
    });
    modelDropzone.addEventListener('dragleave', () => {
        modelDropzone.classList.remove('dragover');
    });
    modelDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        modelDropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleModelFile(e.dataTransfer.files[0]);
        }
    });
    modelFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleModelFile(e.target.files[0]);
        }
    });

    function handleModelFile(file) {
        if (!file.name.endsWith('.pth')) {
            alert('กรุณาเลือกไฟล์ .pth เท่านั้น');
            return;
        }
        selectedModelFile = file;
        modelDropPrompt.style.display = 'none';
        modelFileInfo.style.display = 'flex';
        modelFileName.textContent = file.name;
        modelFileSize.textContent = `(${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    }

    // Submit add model
    addModelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedModelFile) {
            alert('กรุณาเลือกไฟล์โมเดล .pth');
            return;
        }

        const key = document.getElementById('modelKey').value.trim().toLowerCase().replace(/\s+/g, '_');
        const name = document.getElementById('modelName').value.trim();
        const description = document.getElementById('modelDescription').value.trim();

        if (!key || !name) {
            alert('กรุณากรอก Model Key และชื่อแสดงผล');
            return;
        }

        const formData = new FormData();
        formData.append('model_file', selectedModelFile);
        formData.append('key', key);
        formData.append('name', name);
        formData.append('description', description);

        uploadProgress.style.display = 'block';
        uploadProgressFill.style.width = '0%';
        uploadProgressText.textContent = 'กำลังอัปโหลด...';

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/admin/models/upload', true);

            xhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable) {
                    const pct = Math.round((ev.loaded / ev.total) * 100);
                    uploadProgressFill.style.width = `${pct}%`;
                    uploadProgressText.textContent = `กำลังอัปโหลด... ${pct}%`;
                }
            };

            xhr.onload = () => {
                let data;
                try {
                    data = JSON.parse(xhr.responseText);
                } catch (e) {
                    if (xhr.status === 413) {
                        alert('ไฟล์มีขนาดใหญ่เกินไป (ระบบรองรับสูงสุด 1 GB)');
                    } else {
                        alert(`เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (HTTP ${xhr.status})`);
                    }
                    uploadProgress.style.display = 'none';
                    return;
                }

                if (xhr.status === 200 && data.success) {
                    uploadProgressText.textContent = 'อัปโหลดเสร็จสิ้น!';
                    uploadProgressFill.style.width = '100%';
                    setTimeout(() => {
                        addModelModal.style.display = 'none';
                        uploadProgress.style.display = 'none';
                        uploadForm.reset();
                        loadModels();
                        loadStats();
                    }, 800);
                } else {
                    alert(data.error || 'ไม่สามารถเพิ่มโมเดลได้');
                    uploadProgress.style.display = 'none';
                }
            };

            xhr.onerror = () => {
                alert('เกิดข้อผิดพลาดในการอัปโหลด หรือเซิร์ฟเวอร์ไม่ตอบสนอง');
                uploadProgress.style.display = 'none';
            };

            xhr.send(formData);
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการอัปโหลดโมเดล');
            uploadProgress.style.display = 'none';
        }
    });

    // ─── Load History ──────────────────────────────────────────────
    async function loadHistory() {
        try {
            const res = await fetch('/api/admin/history?limit=50');
            if (!res.ok) return;
            const data = await res.json();
            renderHistory(data.logs || []);
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    }

    function renderHistory(logs) {
        historyBody.innerHTML = '';
        if (logs.length === 0) {
            emptyHistory.style.display = 'flex';
            return;
        }
        emptyHistory.style.display = 'none';

        logs.forEach((log, i) => {
            const tr = document.createElement('tr');
            tr.style.animationDelay = `${i * 0.03}s`;
            tr.className = 'history-row';

            const badgeClass = log.is_fake ? 'badge-fake' : 'badge-real';
            const badgeText = log.is_fake ? 'DEEPFAKE' : 'REAL';
            const badgeIcon = log.is_fake ? 'fa-skull-crossbones' : 'fa-circle-check';

            // Format date
            let dateStr = '-';
            if (log.timestamp) {
                const d = new Date(log.timestamp);
                dateStr = d.toLocaleDateString('th-TH', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }

            tr.innerHTML = `
                <td>${i + 1}</td>
                <td class="td-filename" title="${log.filename || '-'}">${truncate(log.filename || '-', 25)}</td>
                <td><span class="badge ${badgeClass}"><i class="fa-solid ${badgeIcon}"></i> ${badgeText}</span></td>
                <td><strong>${log.confidence || 0}%</strong></td>
                <td class="text-real">${log.real_pct || 0}%</td>
                <td class="text-fake">${log.fake_pct || 0}%</td>
                <td>${log.duration || '-'}</td>
                <td>${log.resolution || '-'}</td>
                <td class="td-date">${dateStr}</td>
            `;
            historyBody.appendChild(tr);
        });
    }

    function truncate(str, max) {
        return str.length > max ? str.substring(0, max) + '...' : str;
    }

    // ─── Close modals on overlay click ─────────────────────────────
    addModelModal.addEventListener('click', (e) => {
        if (e.target === addModelModal) addModelModal.style.display = 'none';
    });
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) deleteModal.style.display = 'none';
    });
});
