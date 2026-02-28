// Firebase Configuration (from USER)
const firebaseConfig = {
    apiKey: "AIzaSyARmGt0uPHJH2pejTSQywBVT2VUhV0chVg",
    authDomain: "sinavsistemi-c58fe.firebaseapp.com",
    databaseURL: "https://sinavsistemi-c58fe-default-rtdb.firebaseio.com",
    projectId: "sinavsistemi-c58fe",
    storageBucket: "sinavsistemi-c58fe.firebasestorage.app",
    messagingSenderId: "313707099476",
    appId: "1:313707099476:web:490e18de881799f62b84c1",
    measurementId: "G-PYWHMLXYFW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

document.addEventListener('DOMContentLoaded', () => {
    console.log("=== VERSION 2.35 ===");
    // alert("VERSION 2.35 WORKING"); 
    console.log("Check JS Version: 2.35");
    // --- APP STATE ---
    let userRole = null; // 'admin' | 'judge'
    let currentUser = null;
    let activeVideo = null;
    let isAdminLoggedIn = false;

    const screens = {
        auth: document.getElementById('auth-screen'),
        'admin-auth': document.getElementById('admin-auth-screen'),
        admin: document.getElementById('admin-screen'),
        podium: document.getElementById('podium-screen'),
        judge: document.getElementById('judge-screen'),
        success: document.getElementById('success-screen'),
        settings: document.getElementById('view-settings')
    };

    let globalSettings = {
        diffPoints: { 'A': 0.1, 'B': 0.2, 'C': 0.3, 'D': 0.4, 'E': 0.5, 'F': 0.6, 'G': 0.7, 'H': 0.8, 'I': 0.9, 'J': 1.0 },
        matrixOverrides: {}
    };
    window.globalSettings = globalSettings;

    // Load Global Settings
    db.ref('old/settings/scoring').on('value', snap => {
        const data = snap.val();
        if (data) {
            if (data.diffPoints) globalSettings.diffPoints = data.diffPoints;
            if (data.matrixOverrides) globalSettings.matrixOverrides = data.matrixOverrides;
        }
        // Only render if the function exists and user is admin viewing settings
        if (userRole === 'admin' && typeof renderSettingsTab === 'function') {
            renderSettingsTab();
        }
    });

    // --- INITIALIZATION & AUTH ---
    const isLoginPage = window.location.pathname.includes('admin.html');
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    // Check for saved session in localStorage
    const savedSession = localStorage.getItem('currentUser');

    if (savedSession && !isLoginPage && !token) {
        // Restore session from localStorage
        try {
            const sessionData = JSON.parse(savedSession);
            currentUser = sessionData;
            userRole = 'judge';
            showScreen('judge');
            initJudgeMode();
        } catch (e) {
            console.error('Error restoring session:', e);
            localStorage.removeItem('currentUser');
            showScreen('auth');
        }
    } else if (token) {
        // Judge Auto-Login via Token
        db.ref('old/referees').orderByChild('token').equalTo(token).once('value', snapshot => {
            const data = snapshot.val();
            if (data) {
                const id = Object.keys(data)[0];
                currentUser = { id, ...data[id] };
                userRole = 'judge';

                // Save session to localStorage
                localStorage.setItem('currentUser', JSON.stringify(currentUser));

                showScreen('judge');
                initJudgeMode();
            } else {
                showToast('Geçersiz giriş linki!', 'error');
            }
        });
    } else if (isLoginPage) {
        showScreen('admin-auth');
    } else if (window.location.pathname.includes('monitor.html')) {
        // Monitor Screen Init
        const savedExamId = localStorage.getItem('lastActiveExamId');
        if (savedExamId) {
            loadRefereeScoresView(savedExamId);
        } else {
            document.getElementById('monitor-exam-name').textContent = 'Aktif Sınav Bulunamadı (Admin panelinden sınav seçin)';
        }
    } else if (window.location.pathname.includes('manager.html')) {
        // Manager Screen Init
        loadRefereeManagerView();
    } else {
        showScreen('auth'); // Default judge entry
    }

    // Admin Login in admin.html
    const adminLoginBtn = document.getElementById('btn-admin-login');

    // Helper for login
    const performAdminLogin = () => {
        const pass = document.getElementById('admin-password-input').value;
        if (pass === '63352180') {
            isAdminLoggedIn = true;
            userRole = 'admin';
            localStorage.setItem('adminLoggedIn', 'true'); // Persist
            showScreen('admin');
            initAdminMode();
        } else {
            showToast('Hatalı Şifre!', 'error');
        }
    };

    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', performAdminLogin);
    }

    const adminPassInput = document.getElementById('admin-password-input');
    if (adminPassInput) {
        adminPassInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performAdminLogin();
        });
    }

    // Check Persistent Login
    if (isLoginPage && localStorage.getItem('adminLoggedIn') === 'true') {
        isAdminLoggedIn = true;
        userRole = 'admin';
        showScreen('admin');
        initAdminMode();
    }

    // Judge Login with Email + TCKN
    const judgeLoginBtn = document.getElementById('btn-judge-login');
    if (judgeLoginBtn) {
        judgeLoginBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value.trim().toLowerCase();
            const tckn = document.getElementById('login-tckn').value.trim();
            const errorDiv = document.getElementById('login-error');
            const loader = document.getElementById('auth-loader');

            // Validation
            if (!email || !tckn) {
                errorDiv.textContent = 'Lütfen email ve TCKN giriniz.';
                errorDiv.style.display = 'block';
                return;
            }

            if (tckn.length !== 11 || !/^\d+$/.test(tckn)) {
                errorDiv.textContent = 'TCKN 11 haneli rakamlardan oluşmalıdır.';
                errorDiv.style.display = 'block';
                return;
            }

            errorDiv.style.display = 'none';
            loader.style.display = 'block';

            try {
                // Query Firebase for matching referee
                const snapshot = await db.ref('old/referees').orderByChild('email').equalTo(email).once('value');
                const data = snapshot.val();

                if (data) {
                    // Find referee with matching TCKN
                    let foundRef = null;
                    let foundId = null;

                    for (const [id, ref] of Object.entries(data)) {
                        /* DEBUG LOG: Remove in production */
                        console.log(`[LOGIN CHECK] Trying to match TCKN. Input: "${tckn}" (Type: ${typeof tckn}) | DB: "${ref.tckn}" (Type: ${typeof ref.tckn})`);

                        // Use loose equality or string conversion to match Number vs String
                        if (String(ref.tckn).trim() === String(tckn).trim()) {
                            foundRef = ref;
                            foundId = id;
                            break;
                        }
                    }

                    if (foundRef) {
                        currentUser = { id: foundId, ...foundRef };
                        userRole = 'judge';

                        // Save session to localStorage
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));

                        showScreen('judge');
                        initJudgeMode();
                        showToast(`Hoş geldiniz, ${foundRef.name}!`, 'success');
                    } else {
                        errorDiv.textContent = 'TCKN eşleşmedi. Lütfen bilgilerinizi kontrol edin.';
                        errorDiv.style.display = 'block';
                    }
                } else {
                    errorDiv.textContent = 'Bu email adresi kayıtlı değil.';
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                errorDiv.textContent = 'Giriş sırasında bir hata oluştu.';
                errorDiv.style.display = 'block';
                console.error('Login error:', error);
            } finally {
                loader.style.display = 'none';
            }
        });
    }

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('adminLoggedIn');
            location.href = window.location.pathname;
        });
    }

    // --- ADMIN MODE LOGIC ---
    function initAdminMode() {
        // Tab Navigation
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.admin-subview').forEach(v => v.style.display = 'none');
                const targetEl = document.getElementById(btn.dataset.target);
                if (targetEl) {
                    targetEl.style.display = 'block';
                } else {
                    console.warn(`Target view not found: ${btn.dataset.target}`);
                }

                // Render settings tab when navigating to it
                if (btn.dataset.target === 'view-settings') {
                    renderSettingsTab();

                }
            });
        });

        // EXAM MANAGEMENT
        let activeExamId = null;
        const globalExamSelect = document.getElementById('global-exam-select');

        // Create Exam
        const createExamBtn = document.getElementById('btn-create-exam');
        if (createExamBtn) {
            createExamBtn.addEventListener('click', async () => {
                const name = document.getElementById('exam-name').value.trim();
                const discipline = document.getElementById('exam-discipline').value;

                if (!name) {
                    showToast('Lütfen sınav adı girin!', 'error');
                    return;
                }

                const examData = {
                    name: name,
                    discipline: discipline,
                    createdAt: Date.now(),
                    status: 'active'
                };

                const ref = await db.ref('old/exams').push(examData);
                activeExamId = ref.key;

                // Update global selector
                if (globalExamSelect) {
                    globalExamSelect.value = ref.key;
                }

                document.getElementById('exam-name').value = '';
                showToast('Sınav oluşturuldu!', 'success');
            });
        }

        // Populate Exam Selector
        if (globalExamSelect) {
            db.ref('old/exams').on('value', snapshot => {
                globalExamSelect.innerHTML = '<option value="">Sınav Seçin...</option>';
                const vExamSelect = document.getElementById('v-exam-select');
                if (vExamSelect) vExamSelect.innerHTML = '<option value="">Sınav Seçin...</option>';
                const archivedList = document.getElementById('archived-exams-list');
                if (archivedList) archivedList.innerHTML = '';

                let hasArchived = false;

                snapshot.forEach(child => {
                    const exam = child.val();

                    if (exam.status === 'active') {
                        const opt = document.createElement('option');
                        opt.value = child.key;
                        opt.textContent = `${exam.name} (${exam.discipline})`;
                        globalExamSelect.appendChild(opt);

                        // Populate Video Form Exam Select
                        const vExamSelect = document.getElementById('v-exam-select');
                        if (vExamSelect) {
                            const vOpt = opt.cloneNode(true);
                            vExamSelect.appendChild(vOpt);
                        }
                    } else if (exam.status === 'archived' && archivedList) {
                        hasArchived = true;
                        const date = new Date(exam.createdAt).toLocaleDateString('tr-TR');
                        const div = document.createElement('div');
                        div.className = 'archived-exam-item';
                        div.innerHTML = `
                            <div class="archived-exam-info">
                                <span class="archived-exam-name">${exam.name}</span>
                                <span class="archived-exam-meta">${exam.discipline} • ${date}</span>
                            </div>
                            <div class="video-actions">
                                <button class="primary-btn sm-btn" onclick="restoreExam('${child.key}')">Geri Al</button>
                                <button class="reset-btn sm-btn" onclick="deleteExam('${child.key}')">Sil</button>
                            </div>
                        `;
                        archivedList.appendChild(div);
                    }
                });

                if (!hasArchived && archivedList) {
                    archivedList.innerHTML = '<p style="color:var(--text-dim); text-align:center">Arşivlenmiş sınav yok.</p>';
                }

                // Restore selection
                if (activeExamId) {
                    globalExamSelect.value = activeExamId;
                }

                // CRITICAL FIX: Populate global allExams for other views (like renderPodiums)
                window.allExams = [];
                snapshot.forEach(child => {
                    const e = child.val();
                    e.id = child.key;
                    window.allExams.push(e);
                });

                // Refresh podiums because exam list changed
                if (window.renderPodiums) {
                    window.renderPodiums();
                }
            });

            // On exam selection change
            globalExamSelect.addEventListener('change', async () => {
                activeExamId = globalExamSelect.value;

                if (activeExamId) {
                    localStorage.setItem('activeExamId', activeExamId);
                    localStorage.setItem('lastActiveExamId', activeExamId); // Save for Monitor
                    document.getElementById('active-exam-info').style.display = 'block';
                } else {
                    localStorage.removeItem('activeExamId');
                    localStorage.removeItem('lastActiveExamId');
                    document.getElementById('active-exam-info').style.display = 'none';
                    return; // Exit early if no exam selected
                }

                const infoDiv = document.getElementById('active-exam-info');
                const detailsDiv = document.getElementById('exam-details');

                // Fetch exam details
                const examSnap = await db.ref('old/exams/' + activeExamId).once('value');
                const exam = examSnap.val();

                // Count results for this exam
                const resultsSnap = await db.ref('old/results').orderByChild('examId').equalTo(activeExamId).once('value');
                let resultCount = 0;
                resultsSnap.forEach(() => resultCount++);

                const date = new Date(exam.createdAt).toLocaleDateString('tr-TR');

                if (detailsDiv) {
                    detailsDiv.innerHTML = `
                        <div class="exam-info-row">
                            <span class="exam-info-label">Sınav Adı</span>
                            <span class="exam-info-value">${exam.name}</span>
                        </div>
                        <div class="exam-info-row">
                            <span class="exam-info-label">Branş</span>
                            <span class="exam-info-value">${exam.discipline}</span>
                        </div>
                        <div class="exam-info-row">
                            <span class="exam-info-label">Oluşturma Tarihi</span>
                            <span class="exam-info-value">${date}</span>
                        </div>
                        <div class="exam-info-row">
                            <span class="exam-info-label">Toplam Değerlendirme</span>
                            <span class="exam-info-value">${resultCount}</span>
                        </div>
                    `;
                }

                if (infoDiv) infoDiv.style.display = 'block';

                // Update context labels
                const vidContext = document.getElementById('add-video-context');
                if (vidContext) {
                    vidContext.textContent = `(Sınav: ${exam.name})`;
                }
            });
        }

        // Archive Exam
        const archiveBtn = document.getElementById('btn-archive-exam');
        if (archiveBtn) {
            archiveBtn.addEventListener('click', async () => {
                if (!activeExamId) return showToast('Aktif sınav seçili değil!', 'error');

                if (await showConfirm('Bu sınavı arşivlemek istediğinize emin misiniz?')) {
                    await db.ref('old/exams/' + activeExamId).update({ status: 'archived' });
                    activeExamId = null;
                    if (globalExamSelect) globalExamSelect.value = '';
                    document.getElementById('active-exam-info').style.display = 'none';
                    showToast('Sınav arşivlendi.', 'success');
                }
            });
        }

        // Clear Exam Results
        const clearBtn = document.getElementById('btn-clear-exam-results');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (!activeExamId) return showToast('Aktif sınav seçili değil!', 'error');

                if (await showConfirm('Bu sınavın tüm sonuçlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) {
                    const snap = await db.ref('old/results').orderByChild('examId').equalTo(activeExamId).once('value');
                    const updates = {};
                    snap.forEach(child => {
                        updates['results/' + child.key] = null;
                    });
                    await db.ref().update(updates);

                    // Refresh exam info
                    globalExamSelect.dispatchEvent(new Event('change'));
                    showToast('Sınav sonuçları temizlendi.', 'success');
                }
            });
        }

        // Global functions for archived exams
        window.restoreExam = async (examId) => {
            await db.ref('old/exams/' + examId).update({ status: 'active' });
            showToast('Sınav geri alındı.', 'success');
        };

        window.deleteExam = async (examId) => {
            if (await showConfirm('Bu sınavı kalıcı olarak silmek istediğinize emin misiniz?')) {
                await db.ref('old/exams/' + examId).remove();
                showToast('Sınav silindi.', 'success');
            }
        };
        // Referee Saving Logic
        const refForm = document.getElementById('referee-form');
        if (refForm) {
            refForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log("Referee form submission started");

                try {
                    const name = document.getElementById('ref-name').value.trim();
                    const surname = document.getElementById('ref-surname').value.trim();
                    const email = document.getElementById('ref-email').value.trim();
                    const tckn = document.getElementById('ref-tckn').value.trim();
                    const discipline = document.getElementById('ref-discipline').value;

                    if (!name || !surname || !email || !tckn) {
                        showToast('Lütfen tüm alanları doldurun!', 'error');
                        return;
                    }

                    const token = Math.random().toString(36).substr(2, 9);
                    const refData = {
                        name: `${name} ${surname}`,
                        email,
                        tckn,
                        discipline: discipline,
                        token,
                        createdAt: Date.now()
                    };

                    console.log("Saving referee:", refData);
                    db.ref('old/referees').push(refData);

                    showToast('Hakem başarıyla eklendi', 'success');

                    // Clear inputs
                    document.getElementById('ref-name').value = '';
                    document.getElementById('ref-surname').value = '';
                    document.getElementById('ref-email').value = '';
                    document.getElementById('ref-tckn').value = '';
                    // Keep discipline selected

                } catch (error) {
                    console.error("Error saving referee:", error);
                    showToast('Hata: Hakem kaydedilemedi!', 'error');
                }
            });
        }

        const videoDisciplineSelect = document.getElementById('v-discipline');
        const videoForm = document.getElementById('add-video-form'); // Updated ID



        window.toggleExpertInputs = (type) => {
            const dRow = document.getElementById('row-expert-d');
            const eRow = document.getElementById('row-expert-e');

            if (type === 'D') {
                dRow.style.display = 'flex';
                eRow.style.display = 'none';
            } else {
                dRow.style.display = 'none';
                eRow.style.display = 'flex';
            }
        };

        if (videoForm) {
            videoForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log("Form submission started"); // Debug

                try {
                    const type = document.getElementById('v-type').value;

                    // Cache values to preserve context
                    const cachedDiscipline = videoDisciplineSelect.value;
                    const cachedApparatus = document.getElementById('v-apparatus').value;
                    const cachedType = document.getElementById('v-type').value;

                    // Zorunlu Handling
                    const isZorunlu = document.getElementById('v-is-zorunlu').checked;
                    let expertDMoves = {};
                    if (isZorunlu) {
                        for (let i = 1; i <= 11; i++) {
                            const valEl = document.getElementById(`v-d-${i}`);
                            const invEl = document.getElementById(`v-d-${i}-inv`); // Checkbox

                            if (!valEl) continue; // Safety check

                            const val = valEl.value.trim();
                            const isInv = invEl ? invEl.checked : false;

                            if (val || isInv) {
                                let values = [];
                                if (val) {
                                    if (val.includes(',')) {
                                        values = val.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
                                    } else if (!isNaN(parseFloat(val))) {
                                        values.push(parseFloat(val));
                                    }
                                }

                                if (isInv) {
                                    values.push(0); // 0 represents "Geçersiz"
                                }

                                if (values.length > 0) {
                                    expertDMoves[`d${i}`] = values.length === 1 ? values[0] : values;
                                }
                            }
                        }
                    }

                    const videoData = {
                        discipline: cachedDiscipline,
                        examId: document.getElementById('v-exam-select').value || activeExamId || null,
                        title: document.getElementById('v-title').value,
                        type: cachedType,
                        apparatus: cachedApparatus,
                        url: '', // No video URL - data entry only
                        hasVideo: false, // Explicit flag - no video
                        expertD: type === 'D' ? parseFloat(document.getElementById('v-expert-d').value || 0) : 0,
                        expertE: type === 'E' ? parseFloat(document.getElementById('v-expert-e').value || 0) : 0,
                        isZorunlu: isZorunlu,
                        expertDMoves: isZorunlu ? expertDMoves : null,
                        timestamp: Date.now()
                    };

                    console.log("Saving series data:", videoData); // Debug
                    db.ref('old/videos').push(videoData);
                    showToast('Seri başarıyla eklendi', 'success');

                    // Selective Clear - Only clear content fields, keep context
                    document.getElementById('v-title').value = '';
                    document.getElementById('v-expert-d').value = '';
                    document.getElementById('v-expert-e').value = '';

                    document.getElementById('v-is-zorunlu').checked = false;
                    document.getElementById('zorunlu-add-inputs-container').style.display = 'none';
                    document.querySelectorAll('.d-add-input').forEach(i => i.value = '');

                    // Explicitly restore context (though it should stay if we don't reset)
                    // We don't call videoForm.reset() so these should persist naturally.
                    // This creates a smoother workflow for adding multiple videos to the same category.

                } catch (error) {
                    console.error("Error saving series:", error);
                    showToast('Hata: Seri kaydedilemedi!', 'error');
                }
            });
        } else {
            console.error("Video form element (add-video-form) not found!");
        }

        // CACHE DATA FOR PODIUMS
        // Removed local definitions to use window.allExams and window.allVideos

        // Video filter state
        let videoFilters = { apparatus: 'all', type: 'all', search: '' };

        // Shared definition for rendering video list
        function renderVideoList() {
            const videos = window.allVideos || [];
            const list = document.getElementById('admin-video-list');
            const select = document.getElementById('active-video-select');
            const activeDiscEl = document.getElementById('active-discipline-select');
            const activeDiscipline = activeDiscEl ? activeDiscEl.value : 'WAG';

            console.log('[DEBUG] renderVideoList called - videos:', videos.length, 'discipline:', activeDiscipline);
            console.log('[DEBUG] All videos:', videos.map(v => ({ title: v.title, discipline: v.discipline, apparatus: v.apparatus })));

            // Filter videos
            let filteredVideos = videos.filter(v => v.discipline === activeDiscipline);
            console.log('[DEBUG] After discipline filter:', filteredVideos.length, 'videos');

            // Apply apparatus filter
            if (videoFilters.apparatus !== 'all') {
                filteredVideos = filteredVideos.filter(v => v.apparatus === videoFilters.apparatus);
            }

            // Apply type filter
            if (videoFilters.type !== 'all') {
                filteredVideos = filteredVideos.filter(v => v.type === videoFilters.type);
            }

            // Apply search filter
            if (videoFilters.search) {
                const searchLower = videoFilters.search.toLowerCase();
                filteredVideos = filteredVideos.filter(v => v.title.toLowerCase().includes(searchLower));
            }

            // Update dropdown for podium selection
            if (select) {
                select.innerHTML = '<option value="">Video Seçin...</option>';
                videos.forEach(v => {
                    if (v.discipline !== activeDiscipline) return;
                    const opt = document.createElement('option');
                    opt.value = v.id;
                    opt.textContent = `[${v.apparatus}] [${v.type}] ${v.title}`;
                    select.appendChild(opt);
                });
            }

            // Render grid
            if (list) {
                list.innerHTML = `<h4 style="margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid var(--glass-border)">Seri Listesi (${filteredVideos.length})</h4>`;

                if (filteredVideos.length === 0) {
                    list.innerHTML += `<div style="padding:40px; text-align:center; color:var(--text-dim); background:rgba(0,0,0,0.2); border-radius:12px">Filtre kriterlerine uygun seri bulunamadı.</div>`;
                    return;
                }

                // Create grid container
                const grid = document.createElement('div');
                grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:20px; margin-top:20px';

                console.log('[DEBUG] Rendering grid with', filteredVideos.length, 'videos');
                filteredVideos.forEach((v, index) => {
                    console.log('[DEBUG] Rendering video', index + 1, ':', v.title);
                    const exams = window.allExams || [];
                    const exam = exams.find(e => e.id === v.examId);

                    const card = document.createElement('div');
                    card.className = 'glass-card';
                    card.style.cssText = 'padding:20px; transition:transform 0.2s; cursor:pointer';
                    card.onmouseenter = () => card.style.transform = 'translateY(-4px)';
                    card.onmouseleave = () => card.style.transform = 'translateY(0)';

                    card.innerHTML = `
                        <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap">
                            ${exam ? `<span class="badge tag-E" style="font-size:0.7rem">${exam.name}</span>` : ''}
                            <span class="type-tag tag-${v.type}">${v.type}</span>
                            <span class="badge" style="background:var(--primary); font-size:0.7rem">${v.apparatus}</span>
                        </div>
                        <h4 style="margin:0 0 12px 0; color:var(--text-primary)">${v.title}</h4>
                        <div style="font-size:0.85rem; color:var(--text-dim); margin-bottom:15px">
                            <div>Uzman D: <strong style="color:var(--primary-light)">${(v.expertD || 0).toFixed(2)}</strong></div>
                            <div>Uzman E: <strong style="color:var(--primary-light)">${(v.expertE || 0).toFixed(2)}</strong></div>
                        </div>
                        <div style="display:flex; gap:8px">
                            <button class="primary-btn sm-btn" onclick="editVideo('${v.id}')" style="flex:1">Düzenle</button>
                            <button class="reset-btn sm-btn" onclick="deleteVideo('${v.id}')" style="flex:1">Sil</button>
                        </div>
                    `;

                    grid.appendChild(card);
                });

                list.appendChild(grid);
            }
        }

        // Global Video Listener
        window.allVideos = [];
        db.ref('old/videos').on('value', snapshot => {
            console.log('[DEBUG] ===== FIREBASE SNAPSHOT =====');
            console.log('[DEBUG] Snapshot exists:', snapshot.exists());
            console.log('[DEBUG] Snapshot numChildren:', snapshot.numChildren());
            console.log('[DEBUG] Snapshot val():', snapshot.val());

            window.allVideos = [];
            let count = 0;
            snapshot.forEach(c => {
                count++;
                const videoData = { id: c.key, ...c.val() };
                console.log(`[DEBUG] Video ${count}: ID=${c.key}, Title=${videoData.title}`);
                window.allVideos.push(videoData);
            });

            console.log('[DEBUG] Total videos loaded:', window.allVideos.length);
            console.log('[DEBUG] All video IDs:', window.allVideos.map(v => v.id));

            renderVideoList();

            // Trigger podium refresh
            if (window.renderPodiums) {
                window.renderPodiums();
            }
        });

        // 3. PODIUM MANAGEMENT (New Live Control)
        let allPodiums = {};

        // Add Podium Button
        const btnAddPodium = document.getElementById('btn-add-podium');
        if (btnAddPodium) {
            btnAddPodium.addEventListener('click', () => {
                const count = Object.keys(allPodiums).length + 1;
                db.ref('old/podiums').push({
                    name: `Podyum ${count}`,
                    state: { status: 'IDLE', mode: 'video' },
                    examId: '',
                    createdAt: Date.now()
                });
            });
        }

        // Listen to Podiums (with throttling to prevent excessive re-renders)
        let podiumRenderTimeout = null;
        db.ref('old/podiums').on('value', snap => {
            allPodiums = snap.val() || {};

            // Throttle rendering to prevent excessive updates
            if (podiumRenderTimeout) {
                clearTimeout(podiumRenderTimeout);
            }

            podiumRenderTimeout = setTimeout(() => {
                if (typeof renderPodiums === 'function') {
                    renderPodiums();
                }
            }, 300); // Wait 300ms before rendering
        });

        // Global Listeners for Filters
        const activeDiscSelect = document.getElementById('active-discipline-select');
        if (activeDiscSelect) {
            activeDiscSelect.addEventListener('change', () => {
                renderVideoList();
                renderRefereeList();
            });
        }

        function renderPodiums() {
            const grid = document.getElementById('podium-grid');
            if (!grid) return;

            grid.innerHTML = '';

            // Update referee podium dropdown
            // Update referee podium dropdown
            const refPodiumSelect = document.getElementById('ref-podium');
            const refBulkPodiumSelect = document.getElementById('ref-bulk-podium'); // NEW

            const podiumOptions = Object.entries(allPodiums).map(([pid, podium]) => {
                return `<option value="${pid}">${podium.name}</option>`;
            }).join('');

            if (refPodiumSelect) {
                refPodiumSelect.innerHTML = '<option value="">Podyum Seçin...</option>' + podiumOptions;
            }
            if (refBulkPodiumSelect) {
                refBulkPodiumSelect.innerHTML = '<option value="">Yüklenecek Podyumu Seçin...</option>' + podiumOptions;
            }

            if (Object.keys(allPodiums).length === 0) {
                grid.innerHTML = `
                    <div class="empty-state-message" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim); background: rgba(0,0,0,0.2); border-radius: 12px;">
                        <p>Henüz aktif podyum yok. "Yeni Podyum Ekle" butonu ile başlayın.</p>
                    </div>`;
                return;
            }

            Object.entries(allPodiums).forEach(([pid, podium]) => {
                const card = document.createElement('div');
                card.className = 'podium-card';

                // Active Exam Name
                const exams = window.allExams || [];
                const activeExam = exams.find(e => e.id === podium.examId);
                const examName = activeExam ? activeExam.name : 'Sınav Seçilmedi';

                const isPlaying = podium.state && podium.state.status === 'PLAYING';
                const statusBadge = isPlaying ? '<span class="badge tag-E">YAYINDA</span>' : '<span class="badge">BEKLİYOR</span>';

                // Helpers for dropdowns
                const examOptions = exams.map(e => `<option value="${e.id}" ${e.id === podium.examId ? 'selected' : ''}>${e.name}</option>`).join('');

                // Filter videos by exam discipline if exam is selected
                let videoOptions = '<option value="">Video Seçin...</option>';
                const videos = window.allVideos || [];

                if (activeExam) {
                    // Filter by discipline only - examId check removed for flexibility
                    const filteredVideos = videos.filter(v => {
                        // Match discipline
                        if (v.discipline !== activeExam.discipline) return false;

                        // Allow videos that either:
                        // 1. Belong to this exam specifically
                        // 2. Have no examId (legacy/global videos)
                        // 3. Belong to this exam
                        if (v.examId && v.examId !== activeExam.id) return false;

                        return true;
                    });

                    console.log('[DEBUG] Podium video filter - Exam:', activeExam.name, 'Discipline:', activeExam.discipline, 'Found:', filteredVideos.length, 'of', videos.length);

                    videoOptions += filteredVideos.map(v =>
                        `<option value="${v.id}" ${v.id === (podium.state?.activeVideoId) ? 'selected' : ''}>[${v.apparatus}] ${v.title}</option>`
                    ).join('');
                } else {
                    // No exam selected - show all videos
                    console.log('[DEBUG] Podium - No exam selected, showing all', videos.length, 'videos');
                    videoOptions += videos.map(v =>
                        `<option value="${v.id}" ${v.id === (podium.state?.activeVideoId) ? 'selected' : ''}>[${v.discipline}][${v.apparatus}] ${v.title}</option>`
                    ).join('');
                }

                card.innerHTML = `
                    <h3>
                        <input type="text" value="${podium.name}"
                            onchange="updatePodiumName('${pid}', this.value)"
                            style="background:transparent; border:none; color:inherit; font-weight:bold; width:150px">
                        <button class="reset-btn sm-btn" onclick="deletePodium('${pid}')">Sil</button>
                    </h3>

                    <div class="podium-controls">
                        <select onchange="updatePodiumExam('${pid}', this.value)" style="width:100%; padding:8px; border-radius:6px; margin-bottom:5px">
                            <option value="">Sınav Seçin...</option>
                            ${examOptions}
                        </select>

                        <select id="video-select-${pid}" onchange="updatePodiumVideo('${pid}', this.value)" style="width:100%; padding:8px; border-radius:6px">
                            ${videoOptions}
                        </select>

                        <div style="display:flex; gap:10px; margin-top:5px">
                            <select id="mode-${pid}" onchange="updatePodiumMode('${pid}', this.value)" style="flex:1; padding:8px; border-radius:6px">
                                <option value="video" ${podium.state?.mode === 'video' ? 'selected' : ''}>📹 Video</option>
                                <option value="timer" ${podium.state?.mode === 'timer' ? 'selected' : ''}>⏱️ Süre</option>
                            </select>
                        </div>

                        <div id="timer-input-${pid}" style="margin-top:10px; ${podium.state?.mode === 'timer' ? '' : 'display:none;'}">
                            <label style="font-size:0.8rem; color:var(--text-dim); display:block; margin-bottom:5px">Süre (saniye):</label>
                            <input type="number" id="duration-${pid}" value="${podium.state?.duration || 90}" 
                                onchange="updatePodiumDuration('${pid}', this.value)"
                                style="width:100%; padding:8px; border-radius:6px; background:var(--surface-light); border:1px solid var(--glass-border); color:var(--text-primary)">
                        </div>

                        <div id="selected-series-${pid}" style="margin-top:10px; padding:10px; background:rgba(99, 102, 241, 0.1); border-radius:8px; font-size:0.85rem; display:none;">
                            <!-- Seçilen seri bilgileri buraya gelecek -->
                        </div>

                        <div style="display:flex; gap:10px; margin-top:10px">
                            <button class="start-btn" style="flex:1" onclick="controlPodium('${pid}', 'play')">BAŞLAT</button>
                            ${isPlaying ? `<button class="primary-btn" onclick="controlPodium('${pid}', 'replay')">🔄</button>` : ''}
                            <button class="reset-btn" style="flex:1" onclick="controlPodium('${pid}', 'stop')">DURDUR</button>
                        </div>

                        <div class="podium-status-row">
                            <span>Durum: ${statusBadge}</span>
                            <span>${podium.state?.mode === 'video' ? 'Video Modu' : 'Süre Modu'}</span>
                        </div>
                    </div>
                `;
                grid.appendChild(card);

                // Update selected series info display
                updateSelectedSeriesDisplay(pid, podium.state?.activeVideoId);
            });
        }

        // Global Podium Actions
        window.updatePodiumName = (pid, name) => db.ref(`podiums/${pid}/name`).set(name);
        window.updatePodiumExam = (pid, examId) => db.ref(`podiums/${pid}`).update({ examId });

        window.updatePodiumVideo = (pid, vidId) => {
            db.ref(`podiums/${pid}/state/activeVideoId`).set(vidId);
            updateSelectedSeriesDisplay(pid, vidId);
        };

        window.updatePodiumMode = (pid, mode) => {
            db.ref(`podiums/${pid}/state/mode`).set(mode);
            // Toggle timer input visibility
            const timerInput = document.getElementById(`timer-input-${pid}`);
            if (timerInput) {
                timerInput.style.display = mode === 'timer' ? 'block' : 'none';
            }
        };

        window.updatePodiumDuration = (pid, duration) => {
            db.ref(`podiums/${pid}/state/duration`).set(parseInt(duration));
        };

        // Function to update selected series display
        function updateSelectedSeriesDisplay(pid, videoId) {
            const displayDiv = document.getElementById(`selected-series-${pid}`);
            if (!displayDiv) return;

            if (!videoId) {
                displayDiv.style.display = 'none';
                return;
            }

            const videos = window.allVideos || [];
            const selectedVideo = videos.find(v => v.id === videoId);

            if (selectedVideo) {
                displayDiv.innerHTML = `
                    <div style="font-weight:600; margin-bottom:5px; color:var(--primary-light)">📋 Seçilen Seri:</div>
                    <div><strong>${selectedVideo.title}</strong></div>
                    <div style="margin-top:5px; color:var(--text-dim)">
                        ${selectedVideo.apparatus} | ${selectedVideo.type} Değerlendirmesi
                    </div>
                    <div style="margin-top:5px; font-size:0.8rem">
                        Uzman D: ${(selectedVideo.expertD || 0).toFixed(1)} | 
                        Uzman E: ${(selectedVideo.expertE || 0).toFixed(1)}
                    </div>
                `;
                displayDiv.style.display = 'block';
            } else {
                displayDiv.style.display = 'none';
            }
        }

        window.deletePodium = async (pid) => {
            if (await showConfirm('Podyumu silmek istediğinize emin misiniz?')) {
                db.ref(`podiums/${pid}`).remove();
            }
        };

        window.controlPodium = (pid, action) => {
            const podium = allPodiums[pid];
            if (!podium) return;

            if (action === 'stop') {
                db.ref(`podiums/${pid}/state`).update({ status: 'IDLE' });
            } else if (action === 'play') {
                // Check if series is selected
                if (!podium.state?.activeVideoId) {
                    return showToast('Lütfen bir seri seçin!', 'error');
                }

                // Get selected video/series data
                const videos = window.allVideos || [];
                const selectedSeries = videos.find(v => v.id === podium.state.activeVideoId);

                if (!selectedSeries) {
                    return showToast('Seçilen seri bulunamadı!', 'error');
                }

                // Prepare data to send to judges
                const judgeData = {
                    seriesId: selectedSeries.id,
                    seriesTitle: selectedSeries.title,
                    apparatus: selectedSeries.apparatus,
                    type: selectedSeries.type,
                    expertD: selectedSeries.expertD || 0,
                    expertE: selectedSeries.expertE || 0,
                    isZorunlu: selectedSeries.isZorunlu || false,
                    expertDMoves: selectedSeries.expertDMoves || null,
                    duration: podium.state?.duration || 90,
                    mode: podium.state?.mode || 'timer'
                };

                db.ref(`podiums/${pid}/state`).update({
                    status: 'PLAYING',
                    timestamp: Date.now(),
                    judgeData: judgeData
                });

                showToast(`${selectedSeries.title} - Süre başlatıldı (${judgeData.duration}s)`, 'success');
            } else if (action === 'replay') {
                db.ref(`podiums/${pid}/state`).update({
                    replayTimestamp: Date.now()
                });
                showToast('Süre tekrar başlatıldı', 'info');
            }
        };

        // Filter event listeners
        const filterApparatus = document.getElementById('filter-apparatus');
        const filterType = document.getElementById('filter-type');
        const filterSearch = document.getElementById('filter-search');

        if (filterApparatus) {
            filterApparatus.addEventListener('change', (e) => {
                videoFilters.apparatus = e.target.value;
                renderVideoList();
            });
        }

        if (filterType) {
            filterType.addEventListener('change', (e) => {
                videoFilters.type = e.target.value;
                renderVideoList();
            });
        }

        if (filterSearch) {
            filterSearch.addEventListener('input', (e) => {
                videoFilters.search = e.target.value;
                renderVideoList();
            });
        }

        // Edit video functions
        window.editVideo = function (videoId) {
            const videos = window.allVideos || [];
            const video = videos.find(v => v.id === videoId);
            if (!video) return showToast('Video bulunamadı!', 'error');

            document.getElementById('edit-video-id').value = videoId;
            document.getElementById('edit-v-title').value = video.title;
            document.getElementById('edit-v-discipline').value = video.discipline;
            document.getElementById('edit-v-apparatus').value = video.apparatus;
            document.getElementById('edit-v-type').value = video.type;
            document.getElementById('edit-v-expert-d').value = video.expertD || 0;
            document.getElementById('edit-v-expert-d').value = video.expertD || 0;

            // For Expert E, we want to show the DEDUCTION (10 - score)
            let expertEDeduction = 0;
            if (video.expertE) {
                expertEDeduction = Math.round((10 - video.expertE) * 100) / 100;
            }
            document.getElementById('edit-v-expert-e').value = expertEDeduction;

            // Update placeholder to be clear
            document.getElementById('edit-v-expert-e').placeholder = "Uzman E Kesintisi (Örn: 1.20)";

            toggleEditExpertInputs(video.type);

            const modal = document.getElementById('edit-video-modal');
            if (modal) modal.style.display = 'flex';
        };

        window.closeEditModal = function () {
            const modal = document.getElementById('edit-video-modal');
            if (modal) modal.style.display = 'none';
        };

        window.toggleEditExpertInputs = function (type) {
            const rowD = document.getElementById('edit-row-expert-d');
            const rowE = document.getElementById('edit-row-expert-e');
            if (type === 'D') {
                if (rowD) rowD.style.display = 'flex';
                if (rowE) rowE.style.display = 'none';
            } else {
                if (rowD) rowD.style.display = 'none';
                if (rowE) rowE.style.display = 'flex';
            }
        };

        const editVideoForm = document.getElementById('edit-video-form');
        if (editVideoForm) {
            editVideoForm.addEventListener('submit', (e) => {
                e.preventDefault();

                const videoId = document.getElementById('edit-video-id').value;
                const title = document.getElementById('edit-v-title').value;
                const discipline = document.getElementById('edit-v-discipline').value;
                const apparatus = document.getElementById('edit-v-apparatus').value;
                const type = document.getElementById('edit-v-type').value;
                // expertD is already declared above? No, checking context.
                // It was: const expertD = ... 
                // Then I added: const expertD = ... again in previous turn.
                // Let's fix it properly.

                const expertD = parseFloat(document.getElementById('edit-v-expert-d').value) || 0;
                let expertEVal = parseFloat(document.getElementById('edit-v-expert-e').value) || 0;

                // If type is E, expertEVal is the DEDUCTION, so convert to SCORE
                let finalExpertE = expertEVal;
                if (type === 'E') {
                    finalExpertE = Math.max(0, 10 - expertEVal);
                }

                if (!title) return showToast('Başlık gerekli!', 'error');

                // Zorunlu Handling for Edit
                const isZorunlu = document.getElementById('edit-v-is-zorunlu').checked;
                let expertDMoves = {};

                if (isZorunlu) {
                    for (let i = 1; i <= 11; i++) {
                        const valEl = document.getElementById(`edit-d-${i}`);
                        const invEl = document.getElementById(`edit-d-${i}-inv`); // Checkbox

                        if (!valEl) continue;

                        const val = valEl.value.trim();
                        const isInv = invEl ? invEl.checked : false;

                        if (val || isInv) {
                            let values = [];
                            if (val) {
                                if (val.includes(',')) {
                                    values = val.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
                                } else if (!isNaN(parseFloat(val))) {
                                    values.push(parseFloat(val));
                                }
                            }

                            if (isInv) {
                                values.push(0); // 0 represents "Geçersiz"
                            }

                            if (values.length > 0) {
                                expertDMoves[`d${i}`] = values.length === 1 ? values[0] : values;
                            }
                        }
                    }
                }

                const updateData = {
                    title: title,
                    discipline: discipline,
                    apparatus: apparatus,
                    type: type,
                    expertD: expertD,
                    expertE: finalExpertE,
                    isZorunlu: isZorunlu,
                    expertDMoves: isZorunlu ? expertDMoves : null
                };

                db.ref('old/videos/' + videoId).update(updateData)
                    .then(() => {
                        showToast('Seri güncellendi!', 'success');

                        // Ask if user wants to recalculate judge scores
                        setTimeout(() => {
                            if (confirm('Expert puanları değişti. Hakem puanlarını yeniden hesaplamak ister misiniz?\n\nBu işlem, bu seri için verilen tüm hakem puanlarının sapma değerlerini güncelleyecektir.')) {
                                recalculateJudgeScores(videoId, expertD, finalExpertE);
                            }
                        }, 500);

                        closeEditModal();
                    })
                    .catch(err => {
                        console.error('Update error:', err);
                        showToast('Güncelleme hatası!', 'error');
                    });
            });
        }

        // 2. Referee Management
        window.allReferees = [];

        function renderRefereeList() {
            const list = document.getElementById('admin-ref-list');
            if (!list) return;
            const activeDiscEl = document.getElementById('active-discipline-select');

            // Fallback if element is missing (prevent crash)
            const activeDiscipline = activeDiscEl ? activeDiscEl.value : 'WAG';

            list.innerHTML = `<h4 style="margin-bottom:10px">${activeDiscipline} Serbest Seri Hakem Listesi</h4>`;

            window.allReferees.forEach(r => {
                if (r.discipline !== activeDiscipline) return;

                const div = document.createElement('div');
                div.className = 'video-entry';
                div.innerHTML = `
                    <div style="flex:1">
                        <div style="display:flex; align-items:center; gap:10px">
                            <strong>${r.name}</strong>
                            <span class="badge ${r.examType === 'serbest' ? 'tag-D' : 'tag-E'}" style="font-size:0.7rem">
                                ${(r.examType || 'serbest').toUpperCase()}
                            </span>
                        </div>
                        <div class="video-meta">
                            ${r.email} | ${r.phone || '-'} <br>
                            TCKN: ${r.tckn || '-'} | Token: ${r.token}
                        </div>
                    </div>
                    <div class="video-actions">
                        <button class="primary-btn sm-btn" onclick="copyMagicLink('${r.token}')">Link</button>
                        <button class="primary-btn sm-btn" onclick="sendEmail('${r.key}')">Mail</button>
                        <button class="reset-btn sm-btn" onclick="deleteReferee('${r.key}')">Sil</button>
                    </div>
                `;
                list.appendChild(div);
            });

            if (window.allReferees.filter(r => r.discipline === activeDiscipline).length === 0) {
                list.innerHTML += `<div style="padding:10px; color:var(--text-dim); text-align:center;">Bu kategoride henüz hakem yok.</div>`;
            }
        }

        // --- NEW: Referee Scores Monitoring ---
        let refereeScoresListenerRef = null;
        let cachedRefereeScores = [];

        function loadRefereeScoresView() {
            // Clear previous listener if any
            if (refereeScoresListenerRef) {
                refereeScoresListenerRef.off();
            }

            const tableBody = document.getElementById('referee-scores-table-body');
            const emptyState = document.getElementById('referee-scores-empty');
            const filterSelect = document.getElementById('referee-scores-filter-apparatus');
            const refreshBtn = document.getElementById('btn-refresh-referee-scores');

            if (!tableBody) return;

            // Reset UI
            tableBody.innerHTML = '';
            emptyState.style.display = 'block'; // Show empty initially

            // Helper to format date
            const formatTime = (ts) => {
                if (!ts) return '-';
                const date = new Date(ts);
                return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            };

            // Fetch needed data: Results, Referees, Videos
            const examId = document.getElementById('global-exam-select').value;
            if (!examId) {
                emptyState.innerHTML = '<p>Lütfen önce aktif bir sınav seçin.</p>';
                emptyState.style.display = 'block';
                return;
            }

            // Setup filter listener
            if (filterSelect) {
                const newSelect = filterSelect.cloneNode(true);
                filterSelect.parentNode.replaceChild(newSelect, filterSelect);
                newSelect.addEventListener('change', () => {
                    renderRefereeScoresTable(cachedRefereeScores);
                });
            }

            // Setup refresh listener
            if (refreshBtn) {
                const newBtn = refreshBtn.cloneNode(true);
                refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
                newBtn.addEventListener('click', () => {
                    loadRefereeScoresView(); // Reload
                });
            }

            refereeScoresListenerRef = db.ref(`results/${examId}`);
            refereeScoresListenerRef.on('value', snapshot => {
                const resultsData = snapshot.val() || {};
                const scores = [];

                Object.keys(resultsData).forEach(videoId => {
                    const videoResults = resultsData[videoId];
                    Object.keys(videoResults).forEach(refId => {
                        const result = videoResults[refId];
                        const refObj = window.allReferees.find(r => r.key === refId) || { name: 'Bilinmeyen Hakem' };

                        scores.push({
                            id: videoId + '_' + refId,
                            videoId: videoId,
                            refereeId: refId,
                            refereeName: refObj.name,
                            d: result.d || 0,
                            e: result.e || 0,
                            // If points is stored, use it, otherwise calc sum
                            total: result.points !== undefined ? (result.points * 10) : ((result.d || 0) + (result.e || 0)),
                            timestamp: result.timestamp || Date.now(),
                            apparatus: '',
                            videoTitle: '',
                        });
                    });
                });

                // Fetch Videos to enrich data
                // We assume window.allVideos might not be populated or linked to this correctly yet without fetching
                db.ref('old/videos').orderByChild('examId').equalTo(examId).once('value', vSnap => {
                    const videos = vSnap.val() || {};

                    scores.forEach(s => {
                        const vid = videos[s.videoId];
                        if (vid) {
                            s.videoTitle = vid.title;
                            s.apparatus = vid.apparatus;
                        } else {
                            s.videoTitle = 'Silinmiş Video';
                            s.apparatus = '?';
                        }
                    });

                    scores.sort((a, b) => b.timestamp - a.timestamp);
                    cachedRefereeScores = scores;
                    renderRefereeScoresTable(scores);
                });
            });
        }

        function renderRefereeScoresTable(scores) {
            const tableBody = document.getElementById('referee-scores-table-body');
            const emptyState = document.getElementById('referee-scores-empty');
            const filterApp = document.getElementById('referee-scores-filter-apparatus').value;

            if (!tableBody) return;
            tableBody.innerHTML = '';

            const filtered = scores.filter(s => {
                if (filterApp && s.apparatus !== filterApp) return false;
                return true;
            });

            if (filtered.length === 0) {
                emptyState.style.display = 'block';
                emptyState.innerHTML = '<p>Görüntülenecek puan yok.</p>';
                return;
            }

            emptyState.style.display = 'none';

            filtered.forEach(s => {
                const row = document.createElement('tr');
                const timeStr = s.timestamp ? new Date(s.timestamp).toLocaleTimeString('tr-TR') : '-';

                let appClass = 'tag-default';
                if (s.apparatus === 'AtM') appClass = 'tag-E';
                if (s.apparatus === 'KP') appClass = 'tag-D';
                if (s.apparatus === 'D') appClass = 'tag-Y';
                if (s.apparatus === 'Y') appClass = 'tag-S';

                row.innerHTML = `
                    <td style="color:var(--text-dim); font-size:0.85rem">${timeStr}</td>
                    <td style="font-weight:600">${s.refereeName}</td>
                    <td>${s.videoTitle}</td>
                    <td><span class="badge ${appClass}">${s.apparatus}</span></td>
                    <td style="font-family:monospace; color:var(--primary-light)">${s.d.toFixed(2)}</td>
                    <td style="font-family:monospace; color:var(--secondary-light)">${s.e.toFixed(2)}</td>
                    <td style="font-weight:bold">${s.total.toFixed(2)}</td> 
                `;
                tableBody.appendChild(row);
            });
        }

        const saveRefBtn = document.getElementById('btn-save-referee');
        if (saveRefBtn) {
            saveRefBtn.addEventListener('click', () => {
                const name = document.getElementById('ref-name').value;
                const surname = document.getElementById('ref-surname').value;
                const email = document.getElementById('ref-email').value;
                const tckn = document.getElementById('ref-tckn').value;
                const phone = document.getElementById('ref-phone').value;
                const discipline = document.getElementById('ref-discipline').value;
                const podiumId = document.getElementById('ref-podium').value;

                if (!name || !surname || !email) return showToast('Ad, Soyad ve Email zorunludur!', 'error');
                if (!podiumId) return showToast('Lütfen bir podyum seçin!', 'error');

                const token = Math.random().toString(36).substring(2, 10).toUpperCase();
                const refData = {
                    name: `${name} ${surname}`,
                    firstName: name,
                    lastName: surname,
                    email: email,
                    tckn: tckn,
                    phone: phone,
                    discipline: discipline,
                    podiumId: podiumId,
                    token: token
                };
                db.ref('old/referees').push(refData);

                // Clear
                ['ref-name', 'ref-surname', 'ref-email', 'ref-tckn', 'ref-phone'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                document.getElementById('ref-podium').value = '';
                showToast('Hakem başarıyla eklendi', 'success');
            });
        }

        // --- REF_MANAGER_VIEW: Standalone Podium Management ---
        function loadRefereeManagerView() {
            const tableBody = document.getElementById('manager-referees-body');
            const searchInput = document.getElementById('manager-search');
            const emptyState = document.getElementById('manager-empty');

            if (!tableBody) return;

            // Fetch Podiums Once
            let podiums = [];
            db.ref('old/podiums').once('value', s => {
                const pData = s.val() || {};
                podiums = Object.entries(pData).map(([k, v]) => ({ id: k, ...v }));

                // Listener for Referees
                db.ref('old/referees').on('value', snap => {
                    const rData = snap.val() || {};
                    const referees = Object.entries(rData).map(([k, v]) => ({ key: k, ...v }));

                    const render = (list) => {
                        tableBody.innerHTML = '';
                        if (list.length === 0) {
                            emptyState.style.display = 'block';
                            return;
                        }
                        emptyState.style.display = 'none';

                        list.forEach(r => {
                            const row = document.createElement('tr');

                            // Build Podium Select Options
                            let options = `<option value="">Seçiniz...</option>`;
                            podiums.forEach(p => {
                                const selected = r.podiumId === p.id ? 'selected' : '';
                                options += `<option value="${p.id}" ${selected}>${p.name} (${p.discipline})</option>`;
                            });

                            row.innerHTML = `
                                 <td style="font-weight:600">${r.name}</td>
                                 <td><span class="badge tag-default">${r.discipline || 'Genel'}</span></td>
                                 <td>${(r.examType || 'serbest').toUpperCase()}</td>
                                 <td>
                                     <select class="form-select" onchange="updateRefereePodium('${r.key}', this.value)" style="padding: 5px; font-size: 0.9rem;">
                                         ${options}
                                     </select>
                                 </td>
                                 <td>
                                     <button class="reset-btn sm-btn" onclick="deleteReferee('${r.key}')">Sil</button>
                                 </td>
                             `;
                            tableBody.appendChild(row);
                        });
                    };

                    render(referees);

                    // Search Logic
                    if (searchInput) {
                        searchInput.oninput = (e) => {
                            const term = e.target.value.toLowerCase();
                            const filtered = referees.filter(r => r.name.toLowerCase().includes(term));
                            render(filtered);
                        };
                    }
                });
            });
        }

        window.updateRefereePodium = (refKey, newPodiumId) => {
            if (!refKey) return;
            db.ref(`referees/${refKey}`).update({ podiumId: newPodiumId })
                .then(() => showToast('Podyum güncellendi', 'success'))
                .catch(e => showToast('Hata oluştu', 'error'));
        };

        // --- BULK UPLOAD LOGIC ---
        const btnDownloadTemplate = document.getElementById('btn-download-template');
        const fileInput = document.getElementById('ref-bulk-upload');
        const uploadStatus = document.getElementById('upload-status');

        if (btnDownloadTemplate) {
            btnDownloadTemplate.addEventListener('click', () => {
                if (typeof XLSX === 'undefined') return showToast('Excel kütüphanesi yüklenemedi!', 'error');

                const wb = XLSX.utils.book_new();
                const ws_data = [['Ad', 'Soyad', 'TCKN', 'Telefon', 'Email']]; // Headers
                const ws = XLSX.utils.aoa_to_sheet(ws_data);

                // Add sample data logic (optional)
                XLSX.utils.book_append_sheet(wb, ws, "Hakem Sablonu");
                XLSX.writeFile(wb, "Hakem_Yukleme_Sablonu.xlsx");
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const podiumId = document.getElementById('ref-bulk-podium') ? document.getElementById('ref-bulk-podium').value : document.getElementById('ref-podium').value;
                const discipline = document.getElementById('ref-discipline').value; // Use global/selected discipline

                if (!podiumId) {
                    showToast('Lütfen önce bir podyum seçiniz!', 'error');
                    fileInput.value = ''; // Reset
                    return;
                }

                // Determine Exam Type from Podium -> Exam
                let targetExamType = 'serbest'; // Default
                const podium = allPodiums[podiumId];
                if (podium && podium.examId) {
                    // Try to find exam in local cache
                    const exams = window.allExams || [];
                    const exam = exams.find(e => e.id === podium.examId);
                    if (exam && exam.type) {
                        targetExamType = exam.type;
                    }
                }

                uploadStatus.textContent = 'Yükleniyor...';

                const reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet);

                        if (jsonData.length === 0) {
                            showToast('Dosya boş veya okunamadı.', 'error');
                            uploadStatus.textContent = '';
                            return;
                        }

                        let successCount = 0;
                        let errorCount = 0;

                        jsonData.forEach(row => {
                            // Normalize keys (case insensitive check usually needed but we defined template)
                            // We expect: Ad, Soyad, Email (Required)
                            // Optional: TCKN, Telefon

                            const name = row['Ad'];
                            const surname = row['Soyad'];
                            const rawEmail = row['Email'];
                            const email = rawEmail ? String(rawEmail).trim().toLowerCase() : '';

                            if (name && surname && email) {
                                const token = Math.random().toString(36).substring(2, 10).toUpperCase();
                                const refData = {
                                    name: `${name} ${surname}`,
                                    firstName: name,
                                    lastName: surname,
                                    email: email,
                                    tckn: row['TCKN'] || '',
                                    phone: row['Telefon'] || '',
                                    discipline: discipline,
                                    podiumId: podiumId,
                                    examType: targetExamType,
                                    token: token
                                };
                                db.ref('old/referees').push(refData);
                                successCount++;
                            } else {
                                errorCount++;
                            }
                        });

                        // --- SCORING HELPERS (Removed from here, moved to global scope) ---
                        showToast(`${successCount} hakem başarıyla eklendi. ${errorCount > 0 ? '(' + errorCount + ' hatalı satır)' : ''}`, 'success');
                        uploadStatus.textContent = 'Tamamlandı.';
                        setTimeout(() => { uploadStatus.textContent = ''; }, 3000);

                    } catch (err) {
                        console.error('Excel parse error:', err);
                        showToast('Dosya işlenirken hata oluştu.', 'error');
                        uploadStatus.textContent = 'Hata.';
                    }
                    fileInput.value = ''; // Reset for next use
                };
                reader.readAsArrayBuffer(file);
            });
        }

        db.ref('old/referees').on('value', snapshot => {
            window.allReferees = [];
            snapshot.forEach(child => {
                window.allReferees.push({ key: child.key, ...child.val() });
            });
            renderRefereeList();
        });

        // 3. Live Control with Broadcast Mode
        const btnBroadcast = document.getElementById('btn-broadcast');
        const btnReplay = document.getElementById('btn-replay');
        const btnStop = document.getElementById('btn-stop-exam');
        const broadcastMode = document.getElementById('broadcast-mode');
        const modeDisplay = document.getElementById('current-mode-display');

        if (btnBroadcast) {
            btnBroadcast.addEventListener('click', () => {
                const videoId = document.getElementById('active-video-select').value;
                const mode = broadcastMode ? broadcastMode.value : 'video';

                if (!videoId) return showToast('Lütfen video seçin!', 'error');

                db.ref('old/system_state').set({
                    status: 'PLAYING',
                    activeVideoId: videoId,
                    broadcastMode: mode,
                    timestamp: Date.now()
                });

                // Show replay button
                if (btnReplay) btnReplay.style.display = 'inline-block';
                if (modeDisplay) {
                    modeDisplay.textContent = mode === 'video' ? 'VIDEO MODU' : 'SÜRE MODU';
                    modeDisplay.style.display = 'inline-block';
                }
            });
        }

        // Replay functionality
        if (btnReplay) {
            btnReplay.addEventListener('click', () => {
                db.ref('old/system_state').update({
                    replayTimestamp: Date.now()
                });
                showToast('Video tekrar başlatıldı!', 'info');
            });
        }

        if (btnStop) {
            btnStop.addEventListener('click', () => {
                db.ref('old/system_state').set({
                    status: 'IDLE',
                    activeVideoId: null
                });
                if (btnReplay) btnReplay.style.display = 'none';
                if (modeDisplay) modeDisplay.style.display = 'none';
            });
        }

        db.ref('old/system_state').on('value', snap => {
            const state = snap.val() || { status: 'IDLE' };
            const statusEl = document.getElementById('sync-status');
            if (statusEl) {
                statusEl.textContent = state.status === 'PLAYING' ? 'YAYINDA' : 'BEKLİYOR';
                statusEl.className = `badge ${state.status === 'PLAYING' ? 'tag-E' : ''}`;
            }
        });

        // 4. Hakem Report Logic
        const reportSelect = document.getElementById('report-referee-select');
        if (reportSelect) {
            // Populate referee list
            db.ref('old/referees').on('value', snapshot => {
                reportSelect.innerHTML = '<option value="">Hakem Seçin...</option>';
                snapshot.forEach(child => {
                    const r = child.val();
                    const opt = document.createElement('option');
                    opt.value = child.key;
                    opt.textContent = `${r.name} (${r.discipline})`;
                    reportSelect.appendChild(opt);
                });
            });

            reportSelect.addEventListener('change', async () => {
                const refId = reportSelect.value;
                const contentDiv = document.getElementById('report-content');
                const emptyDiv = document.getElementById('report-empty');
                const summaryDiv = document.getElementById('report-summary');
                const detailsDiv = document.getElementById('report-details');

                if (!refId) {
                    contentDiv.style.display = 'none';
                    emptyDiv.style.display = 'block';
                    return;
                }

                // 1. Fetch Referee Profile
                const refSnap = await db.ref('old/referees/' + refId).once('value');
                const referee = refSnap.val();
                if (!referee) return;

                // 2. Fetch Report Context (Podium -> Exam)
                // Need to find which exam this referee was responsible for via their Podium assignment
                let targetExamId = null;
                console.log('[REPORT] Context Check. Referee:', referee.name, 'PodiumId:', referee.podiumId);
                if (referee.podiumId) {
                    // Try to find the podium in our local cache if available, or fetch it
                    // Since 'allPodiums' might be available globally:
                    if (typeof allPodiums !== 'undefined' && allPodiums[referee.podiumId]) {
                        targetExamId = allPodiums[referee.podiumId].examId;
                    } else {
                        // Fallback fetch
                        const pSnap = await db.ref('old/podiums/' + referee.podiumId).once('value');
                        if (pSnap.exists()) targetExamId = pSnap.val().examId;
                    }
                }

                // 3. Fetch All Videos (Source of Truth) AND Filter
                const allVideos = window.allVideos || [];

                // Primary Filter: Discipline
                let relevantVideos = allVideos.filter(v => v.discipline === referee.discipline);

                // Secondary Filter: Exam ID (if we know the referee's assigned exam)
                // If a referee is assigned to a podium, strictly filter by that podium's active exam.
                if (targetExamId) {
                    relevantVideos = relevantVideos.filter(v => v.examId === targetExamId);
                    console.log('[REPORT] Filtering by ExamId:', targetExamId, '-> Remaining videos:', relevantVideos.length);
                } else {
                    console.log('[REPORT] No ExamId target found, showing all videos for discipline.');
                }

                // 4. Fetch Referee's Results
                const resSnap = await db.ref('old/results').orderByChild('refereeId').equalTo(refId).once('value');
                const resultsMap = {}; // Map<VideoId, Result>
                resSnap.forEach(child => {
                    const r = child.val();
                    resultsMap[r.videoId] = r;
                });

                // 5. Group Logic: Apparatus -> Type (D/E) -> Videos
                const grouped = {};

                // Define Apparatus Order
                const waOrder = ['AtM', 'KP', 'D', 'Y'];
                const magOrder = ['Y', 'KB', 'H', 'AtM', 'PB', 'B'];
                const order = (referee.discipline === 'MAG') ? magOrder : waOrder;

                // Initialize buckets for core apparatuses
                order.forEach(app => {
                    grouped[app] = { D: [], E: [] };
                });

                relevantVideos.forEach(v => {
                    const app = v.apparatus || 'Diğer';
                    const type = v.type || 'E';

                    if (!grouped[app]) grouped[app] = { D: [], E: [] };
                    if (!grouped[app][type]) grouped[app][type] = [];

                    const result = resultsMap[v.id] || null;
                    grouped[app][type].push({ video: v, result: result });
                });

                // Helper: Stats Calculation
                const calcStats = (items) => {
                    if (!items || items.length === 0) return { avg: 0, count: 0, total: 0, present: 0 };
                    let totalScore = 0;
                    let presentCount = 0;

                    items.forEach(item => {
                        if (item.result) {
                            // result.points is generally 0.0-1.0 or calculated similarly
                            // Ensure points are treated as percentage 0-100
                            // In legacy code: ev.points is fraction? 
                            // Let's check how it's stored. Usually points property is 0.xx
                            // Previous usage: (ev.points * 100).toFixed(1)
                            totalScore += (parseFloat(item.result.points) * 100);
                            presentCount++;
                        } else {
                            // 0 points for missing
                            totalScore += 0;
                        }
                    });

                    const avg = (totalScore / items.length).toFixed(1);
                    return { avg, count: items.length, total: totalScore, present: presentCount };
                };

                // Helper: Render Column
                const renderColumn = (title, items) => {
                    const stats = calcStats(items);
                    const avgClass = stats.avg >= 80 ? 'success' : stats.avg >= 60 ? 'warning' : 'danger';

                    let html = `
                        <div style="flex:1; min-width:300px; padding:15px; border-right:1px solid var(--glass-border)">
                            <div style="display:flex; justify-content:space-between; margin-bottom:10px; padding-bottom:5px; border-bottom:1px solid var(--glass-border)">
                                <h5 style="margin:0">${title}</h5>
                                ${stats.count > 0 ? `<span class="badge tag-${stats.avgClass === 'success' ? 'E' : stats.avgClass === 'warning' ? 'D' : 'Y'}">Ort: %${stats.avg} (${stats.present}/${stats.count})</span>` : '<span class="badge">N/A</span>'}
                            </div>
                            <div class="eval-list" style="max-height:300px; overflow-y:auto">
                    `;

                    if (items.length === 0) {
                        html += `<div class="no-data" style="padding:10px; color:var(--text-dim); font-size:0.8rem">Video bulunamadı.</div>`;
                    } else {
                        items.forEach(item => {
                            if (item.result) {
                                // Has result
                                const r = item.result;
                                const pct = (r.points * 100).toFixed(1);
                                const scoreClass = pct >= 80 ? 'success' : pct >= 60 ? 'warning' : 'danger';
                                html += `
                                    <div class="eval-item" style="border-left: 3px solid var(--${scoreClass}); margin-bottom:8px; padding:8px; background:rgba(255,255,255,0.03); border-radius:4px">
                                        <div style="display:flex; justify-content:space-between; font-size:0.85rem">
                                            <span style="color:var(--text-main)">${item.video.title}</span>
                                            <strong style="color:var(--${scoreClass})">%${pct}</strong>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-dim); margin-top:4px">
                                            <span>${r.d > 0 ? `D: ${r.d.toFixed(2)}` : `Kesinti: -${(r.deductions || 0).toFixed(2)}`}</span>
                                            <span>Sapma: ${r.dev.toFixed(2)}</span>
                                        </div>
                                    </div>`;
                            } else {
                                // Missing
                                html += `
                                    <div class="eval-item" style="border-left: 3px solid var(--danger); margin-bottom:8px; padding:8px; background:rgba(220, 38, 38, 0.1); border-radius:4px">
                                        <div style="display:flex; justify-content:space-between; font-size:0.85rem">
                                            <span style="color:var(--text-dim); text-decoration:line-through">${item.video.title}</span>
                                            <strong style="color:var(--danger)">GİRMEDİ</strong>
                                        </div>
                                    </div>`;
                            }
                        });
                    }
                    html += `</div></div>`;
                    return { html, stats };
                };

                const apparatusNames = {
                    'AtM': 'Atlama Masası',
                    'KP': 'Kız Paraleli',
                    'D': 'Denge',
                    'Y': 'Yer',
                    'KB': 'Kulplu Beygir',
                    'H': 'Halkalar',
                    'PB': 'Paralel Bar',
                    'B': 'Barfiks'
                };

                let reportHtml = '';
                let grandTotalScore = 0;
                let grandTotalItems = 0;

                // Get all active keys (predefined ones + any others found)
                const activeKeys = Object.keys(grouped).filter(k =>
                    grouped[k].D.length > 0 || grouped[k].E.length > 0 || order.includes(k)
                ).sort((a, b) => {
                    const idxA = order.indexOf(a);
                    const idxB = order.indexOf(b);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    return a.localeCompare(b);
                });

                activeKeys.forEach(appKey => {
                    const group = grouped[appKey];
                    // Skip if completely empty? User might want to see empty rows in matrix, but card might be noise.
                    // Let's show card only if there are videos.
                    const hasVideos = (group.D.length + group.E.length) > 0;
                    if (!hasVideos) return;

                    const dData = renderColumn('D Puanları', group.D);
                    const eData = renderColumn('E Puanları', group.E);

                    grandTotalScore += dData.stats.total + eData.stats.total;
                    grandTotalItems += dData.stats.count + eData.stats.count;

                    reportHtml += `
                        <div class="apparatus-card glass-card" style="margin-bottom:20px; padding:0; overflow:hidden">
                            <div class="apparatus-header" style="background:rgba(255,255,255,0.05); padding:15px; border-bottom:1px solid var(--glass-border); display:flex; justify-content:space-between; align-items:center">
                                <h3 style="margin:0; font-size:1.1rem; color:var(--primary-light)">${apparatusNames[appKey] || appKey}</h3>
                                <span class="badge">${dData.stats.count + eData.stats.count} Video</span>
                            </div>
                            <div style="display:flex; flex-wrap:wrap">
                                ${dData.html}
                                ${eData.html}
                            </div>
                        </div>
                    `;
                });

                const grandAvg = grandTotalItems > 0 ? (grandTotalScore / grandTotalItems).toFixed(1) : 0;
                const grandClass = grandAvg >= 80 ? 'success' : grandAvg >= 60 ? 'warning' : 'danger';

                // --- Official Summary Matrix Generation ---
                let tableHtml = `
                    <div class="glass-card" style="margin-top:40px; overflow-x:auto;">
                        <h3 style="margin-bottom:15px; text-align:center; text-transform:uppercase; letter-spacing:1px; color: gold;">Sınav Sonuç Kartı</h3>
                        <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9rem;">
                            <thead>
                                <tr style="background:#1e293b; color:white;">
                                    <th style="padding:10px; border:1px solid #334155;"></th>
                                    ${order.map(app => `<th colspan="2" style="padding:10px; border:1px solid #334155;">${apparatusNames[app] || app}</th>`).join('')}
                                    <th colspan="2" style="padding:10px; border:1px solid #334155;">GENEL</th>
                                </tr>
                                <tr style="background:#334155; color:white;">
                                    <th style="padding:8px; border:1px solid #475569;">AD SOYAD</th>
                                    ${order.map(() => `
                                        <th style="padding:8px; border:1px solid #475569;">D</th>
                                        <th style="padding:8px; border:1px solid #475569;">E</th>
                                    `).join('')}
                                    <th style="padding:8px; border:1px solid #475569;">ORT</th>
                                    <th style="padding:8px; border:1px solid #475569;">NOT</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                // Determine Grade
                let gradeText = 'Başarısız';
                let gradeColor = 'var(--danger)';
                if (grandAvg >= 90) { gradeText = 'MÜKEMMEL'; gradeColor = 'gold'; }
                else if (grandAvg >= 85) { gradeText = 'ÇOK İYİ'; gradeColor = 'var(--success)'; }
                else if (grandAvg >= 80) { gradeText = 'İYİ'; gradeColor = '#a3e635'; }
                else if (grandAvg >= 70) { gradeText = 'ORTA'; gradeColor = 'var(--warning)'; }
                else if (grandAvg >= 60) { gradeText = 'GEÇER'; gradeColor = 'orange'; }

                let rowHtml = `<tr>
                    <td style="padding:10px; border:1px solid #475569; font-weight:bold; color:var(--text-main); text-align:left">${referee.name}</td>`;

                order.forEach(app => {
                    const group = grouped[app] || { D: [], E: [] };
                    const dS = calcStats(group.D);
                    const eS = calcStats(group.E);

                    const color = (s) => (s.count === 0) ? 'color:var(--text-dim)' : (s.avg >= 80 ? 'color:var(--success)' : s.avg >= 60 ? 'color:var(--warning)' : 'color:var(--danger)');

                    rowHtml += `<td style="padding:8px; border:1px solid #475569; ${color(dS)}">${dS.count > 0 ? '%' + dS.avg : '-'}</td>`;
                    rowHtml += `<td style="padding:8px; border:1px solid #475569; ${color(eS)}">${eS.count > 0 ? '%' + eS.avg : '-'}</td>`;
                });

                rowHtml += `
                    <td style="padding:8px; border:1px solid #475569; font-weight:bold; color:var(--text-main)">%${grandAvg}</td>
                    <td style="padding:8px; border:1px solid #475569; font-weight:bold; color:${gradeColor}">${gradeText}</td>
                </tr>`;

                tableHtml += rowHtml + `</tbody></table></div>`;

                // Update Summary Header
                summaryDiv.innerHTML = `
                    <h2>${referee.name}</h2>
                    <p style="color:var(--text-dim)">${referee.discipline} - ${targetExamId ? 'Sadece Atandığı Podyum Sınavı' : 'Genel'} - Toplam ${grandTotalItems} Video</p>
                    <div class="overall-score" style="color: var(--${grandClass})">${grandAvg}%</div>
                    <p style="font-size:0.9rem; color:var(--text-dim)">Genel Başarı Ortalaması</p>
                `;

                detailsDiv.innerHTML = reportHtml + tableHtml;
                contentDiv.style.display = 'block';
                emptyDiv.style.display = 'none';
            });
        }

        // 5. Scoring Settings Logic
        // 5. Scoring Settings Logic (Excel Mode)
        window.renderSettingsTab = () => {
            const hRow = document.getElementById('diff-header');
            const bRow = document.getElementById('diff-body');
            if (!hRow || !bRow) return;

            hRow.innerHTML = '';
            bRow.innerHTML = '';

            Object.entries(globalSettings.diffPoints).sort().forEach(([lvl, val]) => {
                const th = document.createElement('th');
                th.textContent = lvl;
                hRow.appendChild(th);

                const td = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'number';
                input.step = '0.1';
                input.value = val;
                input.className = 'excel-input diff-cell';
                input.dataset.lvl = lvl;
                td.appendChild(input);
                bRow.appendChild(td);
            });

            // 2. Excel Matrix
            renderExcelMatrix();
        };

        function renderExcelMatrix() {
            const theadRow = document.getElementById('matrix-header');
            const tbody = document.getElementById('matrix-body');
            if (!theadRow || !tbody) return;

            const maxDev = 2.0;    // Columns
            const maxExpert = 6.0; // Rows

            theadRow.innerHTML = `
                <th style="min-width: 140px; position: sticky; left: 0; background: #0f172a; z-index: 20; border-right: 2px solid var(--primary); color: white;">
                    <div style="font-size: 0.65rem; color: var(--text-dim); text-align: left; line-height: 1.2;">SAPMA &rarr;</div>
                    <div style="font-size: 0.9rem; margin: 4px 0;">UZMAN \\ SAPMA</div>
                    <div style="font-size: 0.65rem; color: var(--text-dim); text-align: left; line-height: 1.2;">&darr; UZMAN</div>
                </th>
            `;
            tbody.innerHTML = '';

            // Generate Header Columns (Deviations)
            for (let d = 0; d <= maxDev * 10; d++) {
                const devVal = (d / 10).toFixed(1);
                const th = document.createElement('th');
                th.style.minWidth = '75px';
                th.innerHTML = `<div style="font-size:0.8rem; color:var(--primary-light)">${devVal}</div>`;
                theadRow.appendChild(th);
            }

            // Generate Body Rows (Expert Deductions)
            for (let e = 0; e <= maxExpert * 10; e++) {
                const expVal = (e / 10).toFixed(1);
                const tr = document.createElement('tr');

                // Row Label (Expert Val) - Sticky Left
                const tdLabel = document.createElement('td');
                tdLabel.className = 'row-label';
                tdLabel.textContent = expVal;
                tr.appendChild(tdLabel);

                // Cells
                for (let d = 0; d <= maxDev * 10; d++) {
                    const devVal = (d / 10).toFixed(1);
                    const td = document.createElement('td');
                    const val = getMatrixValue(expVal, devVal);

                    const input = document.createElement('input');
                    input.type = 'number';
                    input.step = '0.05';
                    input.className = 'excel-input matrix-cell';
                    input.dataset.row = expVal;
                    input.dataset.col = devVal;
                    input.value = val;

                    td.appendChild(input);
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
        }

        // Save Difficulty Points
        const btnSaveDiff = document.getElementById('btn-save-diff-points');
        if (btnSaveDiff) {
            btnSaveDiff.onclick = () => {
                const updates = {};
                document.querySelectorAll('.diff-cell').forEach(input => {
                    updates[input.dataset.lvl] = parseFloat(input.value);
                });
                db.ref('old/settings/scoring/diffPoints').set(updates);
                showToast('Zorluk puanları güncellendi.', 'success');
            };
        }

        // Save Full Excel Matrix
        const btnSaveMatrix = document.getElementById('btn-save-full-matrix');
        if (btnSaveMatrix) {
            btnSaveMatrix.onclick = async () => {
                if (await showConfirm('Tüm tablodaki değişiklikler kaydedilsin mi?')) {
                    const inputs = document.querySelectorAll('.matrix-cell');
                    const dataMap = {};

                    inputs.forEach(input => {
                        const r = input.dataset.row.replace('.', '_'); // Firebase key safe
                        const c = input.dataset.col;
                        const v = parseFloat(input.value);

                        if (!dataMap[r]) dataMap[r] = {};
                        dataMap[r][c] = v;
                    });

                    // Update overrides in Firebase
                    db.ref('old/settings/scoring/matrixOverrides').update(dataMap);

                    showToast('Tablo değişiklikleri başarıyla kaydedildi.', 'success');
                }
            };
        }

        // 4. Stats View - Grouped with History and Validation
        // 4. Stats View - Grouped with History and Validation
        db.ref('old/results').on('value', snapshot => {
            const table = document.getElementById('stats-table-body');
            if (!table) return; // Exit if not on admin page

            table.innerHTML = '';
            const allResults = [];
            snapshot.forEach(child => {
                allResults.push({ id: child.key, ...child.val() });
            });

            // Grouping: videoId -> refereeId -> [results]
            const groups = {};
            allResults.forEach(res => {
                const groupKey = `${res.videoId}_${res.refereeId}`;
                if (!groups[groupKey]) groups[groupKey] = [];
                groups[groupKey].push(res);
            });

            for (const key in groups) {
                const resList = groups[key].sort((a, b) => b.timestamp - a.timestamp); // Latest first

                // If only one, it's valid. If multiple, latest is valid unless admin picked another.
                let validIndex = resList.findIndex(r => r.isValid === true);
                if (validIndex === -1) validIndex = 0;

                const validRes = resList[validIndex];
                const tr = document.createElement('tr');
                tr.className = 'stats-row';
                const pointDisplay = (validRes.points * 100).toFixed(1) + '%';
                const hasHistory = resList.length > 1;

                tr.innerHTML = `
                    <td>${validRes.refereeName}</td>
                    <td>${validRes.videoTitle}</td>
                    <td>D:${validRes.d.toFixed(1)} / E:${validRes.e.toFixed(1)}</td>
                    <td>Sapma: ${validRes.dev.toFixed(2)}</td>
                    <td>
                        <strong style="color:var(--primary-light)">${pointDisplay}</strong>
                        <span class="status-badge valid">ONAYLI</span>
                    </td>
                    <td>
                        <div class="stats-actions">
                            ${hasHistory ? `<button class="history-btn sm-btn" onclick="toggleHistory('${key}')">Eski Girişler (${resList.length})</button>` : ''}
                        </div>
                    </td>
                `;
                table.appendChild(tr);

                // Hidden History Row
                if (hasHistory) {
                    const historyTr = document.createElement('tr');
                    historyTr.id = `history-${key}`;
                    historyTr.style.display = 'none';
                    historyTr.className = 'history-container-row';

                    let historyHtml = '<td colspan="4"><div class="history-grid">';
                    let details = "";
                    resList.forEach((r, idx) => {
                        const isCurrentlyValid = (idx === validIndex);
                        const rPoint = (r.points * 100).toFixed(1) + '%';
                        // Breakdown Details
                        details += `<div>${r.refereeName}: ${rPoint} (S:${r.dev})</div>`;
                    });
                    historyHtml += details + '</div></td>';
                    historyTr.innerHTML = historyHtml;
                    table.appendChild(historyTr);
                }
            }
        });
    }

    function initJudgeMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const pid = urlParams.get('p') || urlParams.get('pid');

        // If no pid and not admin, maybe redirect? For now just return if no pid.
        if (!pid) return;

        // Transition to judge screen
        showScreen('judge');

        // Set Header Info Immediately
        document.getElementById('j-display-name').textContent = currentUser.name || 'Misafir Hakem';

        // Presence Logic
        const presenceRef = db.ref('old/podiums/' + pid + '/online_judges/' + currentUser.id);
        presenceRef.set({ name: currentUser.name, status: 'online' });
        presenceRef.onDisconnect().remove();

        // Listen to Podium State
        db.ref('old/podiums/' + pid).on('value', async snapshot => {
            const podium = snapshot.val();
            console.log('[JUDGE] Podium data received:', podium);
            if (!podium) {
                showToast('Podyum kapatıldı!', 'error');
                setTimeout(() => location.reload(), 2000);
                return;
            }

            currentPodiumExamId = podium.examId;
            const state = podium.state || { status: 'IDLE' };
            console.log('[JUDGE] Podium state:', state);

            if (state.status === 'PLAYING') {
                // Get judge data from podium state
                const judgeData = state.judgeData || {};
                console.log('[JUDGE] Judge data from podium:', judgeData);

                // Determine incoming video/series ID
                const incomingId = (state.mode === 'timer' || !state.activeVideoId)
                    ? (judgeData.seriesId || 'timer-mode')
                    : state.activeVideoId;

                // CRITICAL FIX: Only reinitialize if video/series has actually changed
                const needsReinit = !currentActiveVideo || currentActiveVideo.id !== incomingId;

                if (!needsReinit) {
                    console.log('[JUDGE] Already on this video/series, skipping reinit to prevent toast spam');
                    return;
                }

                console.log('[JUDGE] New video/series detected, initializing:', incomingId);

                if (state.mode === 'timer' || !state.activeVideoId) {
                    // Timer mode - show series data and timer
                    console.log('[JUDGE] Timer mode judgeData:', judgeData); // DEBUG
                    currentActiveVideo = {
                        id: judgeData.seriesId || 'timer-mode',
                        title: judgeData.seriesTitle || 'Süre Başlatıldı',
                        apparatus: judgeData.apparatus || '',
                        type: judgeData.type || 'E',
                        expertD: judgeData.expertD || 0,
                        expertE: judgeData.expertE || 0,
                        isZorunlu: judgeData.isZorunlu || false,
                        expertDMoves: judgeData.expertDMoves || null,
                        duration: judgeData.duration || 90
                    };
                    console.log('[JUDGE] currentActiveVideo:', currentActiveVideo); // DEBUG
                    startExamForJudge(true, judgeData.duration); // true = timer mode, pass duration
                } else {
                    // Video mode (legacy - not used anymore but kept for compatibility)
                    if (state.activeVideoId) {
                        // REMOVED: const vSnap = await db.ref('old/videos/' + state.activeVideoId).once('value');
                        // CHANGED TO: Real-time listener

                        // If we are already listening to this video, don't re-attach unless necessary
                        if (window.activeVideoListenerId === state.activeVideoId) {
                            console.log('[JUDGE] Already listening to video updates:', state.activeVideoId);
                            return;
                        }

                        // Detach previous listener if exists
                        if (window.activeVideoListenerRef) {
                            window.activeVideoListenerRef.off();
                        }

                        console.log('[JUDGE] Attaching real-time listener to video:', state.activeVideoId);
                        window.activeVideoListenerId = state.activeVideoId;
                        window.activeVideoListenerRef = db.ref('old/videos/' + state.activeVideoId);

                        window.activeVideoListenerRef.on('value', vSnap => {
                            if (vSnap.exists()) {
                                console.log('[JUDGE] Video data updated:', vSnap.val());
                                currentActiveVideo = { id: state.activeVideoId, ...vSnap.val() };
                                startExamForJudge();
                            } else {
                                console.warn("Video data not found:", state.activeVideoId);
                                document.getElementById('j-display-apparatus').textContent = podium.name;
                                resetJudgeUI();
                                showScreen('judge');
                            }
                        });
                    } else {
                        // Detach listener if no video
                        if (window.activeVideoListenerRef) {
                            window.activeVideoListenerRef.off();
                            window.activeVideoListenerRef = null;
                            window.activeVideoListenerId = null;
                        }

                        // Playing but no video selected yet
                        document.getElementById('j-display-apparatus').textContent = podium.name;
                        resetJudgeUI();
                        showScreen('judge');
                    }
                }
            } else {
                console.log('[JUDGE] Podium not playing, status:', state.status);

                // Clear timer if exists
                if (activeTimerInterval) {
                    clearInterval(activeTimerInterval);
                    activeTimerInterval = null;
                }

                if (state.replayTimestamp && Date.now() - state.replayTimestamp < 5000) {
                    // Replay trigger (simple check)
                    const vid = document.getElementById('exam-video-element');
                    if (vid) vid.currentTime = 0;
                    if (vid) vid.play();
                }

                // Update header to show Podium Name when waiting
                document.getElementById('j-display-apparatus').textContent = podium.name;
                resetJudgeUI();
                showScreen('judge');
            }
        });
    }

    // Suzan Yazıcı Style: E-Scoring Keypad
    document.querySelectorAll('.num-key').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.val;
            const display = document.getElementById('j-e-deduction-display');

            if (val === '.' && display.value.includes('.')) return;

            if (display.value === '0' && val !== '.') {
                display.value = val;
            } else {
                display.value += val;
            }

            if (parseFloat(display.value) > 10) display.value = "10";

            updateEScoreFromInput();
        });
    });

    const clearBtn = document.getElementById('j-e-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const display = document.getElementById('j-e-deduction-display');
            if (display) {
                display.value = '';
                updateEScoreFromInput();
            }
        });
    }

    function updateEScoreFromInput() {
        const input = document.getElementById('j-e-deduction-display').value;
        const deduction = input ? parseFloat(input) : 0;
        judgeData.deductions = deduction;
        judgeData.e = Math.max(0, 10 - deduction);
        document.getElementById('j-val-deduction').textContent = deduction.toFixed(2);
        document.getElementById('j-score-e').textContent = judgeData.e.toFixed(2);
    }

    // Suzan Yazıcı Style: D-Score Bonus Options
    document.querySelectorAll('#j-cr-options .bonus-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#j-cr-options .bonus-opt').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            judgeData.cr = parseFloat(btn.dataset.val);
            updateJudgeD();
        });
    });

    document.querySelectorAll('#j-cv-options .bonus-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#j-cv-options .bonus-opt').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            judgeData.cv = parseFloat(btn.dataset.val);
            updateJudgeD();
        });
    });

    document.querySelectorAll('#j-btrs-options .bonus-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#j-btrs-options .bonus-opt').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            judgeData.btrs = parseFloat(btn.dataset.val);
            updateJudgeD();
        });
    });

    // Vault D-Score Keypad (New Implementation)
    document.querySelectorAll('.num-key-vault').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.val;
            const display = document.getElementById('j-d-vault-display');

            if (!display) return;

            if (val === '.' && display.value.includes('.')) return;

            if (display.value === '0' && val !== '.') {
                display.value = val;
            } else {
                display.value += val;
            }

            // Update Vault Base Value (not final D)
            judgeData.vaultValue = parseFloat(display.value) || 0;
            updateJudgeD();
        });
    });

    const vaultClearBtn = document.getElementById('j-d-vault-clear');
    if (vaultClearBtn) {
        vaultClearBtn.addEventListener('click', () => {
            const display = document.getElementById('j-d-vault-display');
            if (display) {
                display.value = '';
                judgeData.vaultValue = 0;
                updateJudgeD();
            }
        });
    }

    const btnSubmitScore = document.getElementById('btn-submit-score');
    if (btnSubmitScore) {
        btnSubmitScore.addEventListener('click', async () => {
            const judgeD = Math.round(judgeData.d * 100) / 100;
            const judgeE = Math.round(judgeData.e * 100) / 100;
            const expD = Math.round(currentActiveVideo.expertD * 100) / 100;
            const expE = Math.round(currentActiveVideo.expertE * 100) / 100;

            let finalPoints = 0;
            let deviation = 0;

            if (currentActiveVideo.type === 'D') {
                // D-Score Scoring Logic: NOW USES MATRIX (Non-Linear)
                // For Vault, use vaultValue instead of d
                const actualJudgeD = judgeData.vaultValue !== undefined ? judgeData.vaultValue : judgeD;
                deviation = Math.abs(actualJudgeD - expD);

                // Use Matrix Lookup
                const rowKey = expD.toFixed(1);
                const diffKey = deviation.toFixed(1);
                finalPoints = getMatrixValue(rowKey, diffKey);
            } else {
                // E-Score Scoring Logic: Direct Comparison
                const expertVal = Math.round(expE * 10) / 10;
                const judgeVal = Math.round(judgeData.deductions * 10) / 10;
                deviation = Math.round(Math.abs(expertVal - judgeVal) * 10) / 10;
                const rowKey = expertVal.toFixed(1);
                const diffKey = deviation.toFixed(1);
                finalPoints = getMatrixValue(rowKey, diffKey);
                // For results storage
                deviation = Math.abs(expertVal - judgeVal);
            }

            // Puan Özetini Hazırla
            let summaryHtml = "";
            if (currentActiveVideo.type === 'D') {
                const movesStr = Object.entries(judgeData.totalMoves || {}).filter(([l, c]) => c > 0).map(([l, c]) => `${l}x${c}`).join(', ');
                summaryHtml = `
                    <div class="summary-title">Girdiğiniz D-Puanı</div>
                    <div class="summary-main">${judgeD.toFixed(2)}</div>
                    <div class="summary-sub">Detay: [${movesStr || 'Element Yok'}] | CR:${judgeData.cr} | CV:${judgeData.cv} | BTRS:${judgeData.btrs}</div>
                `;
            } else {
                summaryHtml = `
                    <div class="summary-title">Girdiğiniz E-Puanı</div>
                    <div class="summary-main">${judgeE.toFixed(2)}</div>
                    <div class="summary-sub">Kesinti: ${judgeData.deductions.toFixed(2)}</div>
                `;
            }
            document.getElementById('submitted-score-summary').innerHTML = summaryHtml;

            // Prepare Data Object
            const dataToSave = {
                examId: currentPodiumExamId || null,
                refereeId: currentUser.id,
                refereeName: currentUser.name,
                videoId: currentActiveVideo.id,
                videoTitle: currentActiveVideo.title,
                d: judgeD,
                e: judgeE,
                deductions: judgeData.deductions || 0,
                zorunluDeduction: judgeData.zorunluDeduction || 0, // Save Zorunlu deduction
                dev: deviation,
                points: finalPoints,
                breakdown: judgeData.totalMoves || {},
                cr: judgeData.cr || 0,
                cv: judgeData.cv || 0,
                btrs: judgeData.btrs || 0,
                timestamp: Date.now()
            };

            // CHECK EXISTING RECORD
            try {
                const snapshot = await db.ref('old/results')
                    .orderByChild('refereeId')
                    .equalTo(currentUser.id)
                    .once('value');

                let existingKey = null;
                let existingData = null;

                if (snapshot.exists()) {
                    snapshot.forEach(child => {
                        const val = child.val();
                        if (val.videoId === currentActiveVideo.id) {
                            existingKey = child.key;
                            existingData = val;
                        }
                    });
                }

                if (existingKey) {
                    // UPDATE EXISTING with HISTORY
                    const historyEntry = {
                        d: existingData.d,
                        e: existingData.e,
                        deductions: existingData.deductions || 0,
                        points: existingData.points,
                        timestamp: existingData.timestamp,
                        breakdown: existingData.breakdown || {}
                    };

                    const history = existingData.history || [];
                    history.push(historyEntry);

                    dataToSave.history = history;

                    await db.ref('old/results/' + existingKey).update(dataToSave);
                    showToast('Puan güncellendi (Eski puan geçmişe eklendi).', 'success');
                } else {
                    // CREATE NEW
                    await db.ref('old/results').push(dataToSave);
                    showToast('Puan başarıyla gönderildi.', 'success');
                }
            } catch (error) {
                console.error('Save error:', error);
                showToast('Hata oluştu, lütfen tekrar deneyin.', 'error');
                return;
            }

            // Save to previousScores for re-editing
            previousScores[currentActiveVideo.id] = {
                d: judgeD,
                e: judgeE,
                deductions: judgeData.deductions || 0,
                totalMoves: judgeData.totalMoves || {},
                cr: judgeData.cr || 0,
                cv: judgeData.cv || 0,
                btrs: judgeData.btrs || 0
            };

            showScreen('success');
        });
    }


    function updateJudgeD() {
        // Check if this is Vault apparatus
        const isVault = currentActiveVideo && currentActiveVideo.apparatus === 'Y';

        if (isVault && judgeData.vaultValue !== undefined) {
            // For Vault, D score is ONLY the vault value (no bonuses added)
            judgeData.d = judgeData.vaultValue;
        } else {
            // For other apparatus, calculate from moves and bonuses
            let dFromMoves = 0;

            for (const [level, count] of Object.entries(judgeData.totalMoves || {})) {
                const pointVal = globalSettings.diffPoints[level] || 0;
                dFromMoves += (count * pointVal);
            }

            // Total D = Moves + Bonuses (CV, CR, BTRS)
            judgeData.d = dFromMoves + judgeData.cv + judgeData.cr + (judgeData.btrs || 0);
        }

        document.getElementById('j-score-d').textContent = judgeData.d.toFixed(2);
    }

    async function startExamForJudge(isTimerMode = false, duration = 90) {
        const seriesTitle = currentActiveVideo.title || 'Seri';
        const apparatus = currentActiveVideo.apparatus || '';
        const type = currentActiveVideo.type || 'E';

        // Update Header Info
        document.getElementById('j-display-apparatus').textContent = `${apparatus} - ${type}`;
        document.getElementById('j-series-info').textContent = seriesTitle;

        // Start Timer Logic
        let remainingTime = duration;
        const timerDisplay = document.getElementById('j-timer');

        // Clear any existing timer
        if (activeTimerInterval) clearInterval(activeTimerInterval);

        activeTimerInterval = setInterval(() => {
            remainingTime--;
            if (timerDisplay) {
                // Format nicely: 01:30
                const mins = Math.floor(remainingTime / 60).toString().padStart(2, '0');
                const secs = (remainingTime % 60).toString().padStart(2, '0');
                timerDisplay.textContent = `${mins}:${secs}`;

                if (remainingTime <= 10) {
                    timerDisplay.style.color = 'var(--error)';
                    timerDisplay.style.borderColor = 'var(--error)';
                } else {
                    timerDisplay.style.color = 'var(--warning)';
                    timerDisplay.style.borderColor = 'var(--glass-border)';
                }
            }

            if (remainingTime <= 0) {
                clearInterval(activeTimerInterval);
                activeTimerInterval = null;
                if (timerDisplay) {
                    timerDisplay.textContent = '00:00';
                    timerDisplay.style.color = 'var(--error)';
                }
                showToast('Süre bitti!', 'warning');
            }
        }, 1000);

        document.getElementById('btn-submit-score').disabled = false;
        showScreen('judge');

        // Dynamic Panel Visibility
        const panelD = document.getElementById('panel-d');
        const panelE = document.getElementById('panel-e');

        // Show panel based on video type (D or E), not referee's fixed role
        const videoType = currentActiveVideo.type || 'E';
        console.log('[JUDGE] Video type:', videoType);

        panelD.style.display = videoType === 'D' ? 'block' : 'none';
        panelE.style.display = videoType === 'E' ? 'block' : 'none';

        if (videoType === 'D') {
            // Already called in setup logic below
        }

        // Reset Data or Load Previous Scores
        // Check local cache first
        let previousScore = previousScores[currentActiveVideo.id];

        // If not in cache, check Firebase
        if (!previousScore) {
            try {
                const snapshot = await db.ref('old/results')
                    .orderByChild('refereeId')
                    .equalTo(currentUser.id)
                    .once('value');

                if (snapshot.exists()) {
                    snapshot.forEach(child => {
                        const val = child.val();
                        if (val.videoId === currentActiveVideo.id) {
                            previousScore = val;
                            // Map storage format to local format
                            previousScore.totalMoves = val.breakdown || {};
                            // Cache it
                            previousScores[currentActiveVideo.id] = previousScore;
                        }
                    });
                }
            } catch (err) {
                console.error('Error fetching previous scores:', err);
            }
        }

        if (previousScore) {
            // Load previous scores
            console.log('[JUDGE] Loading previous scores for series:', currentActiveVideo.id);
            judgeData = {
                d: previousScore.d || 0,
                e: previousScore.e || 10,
                deductions: previousScore.deductions || 0,
                totalMoves: previousScore.totalMoves || {},
                cv: previousScore.cv || 0,
                cr: previousScore.cr || 0
            };

            // Update UI with previous scores
            document.getElementById('j-score-e').textContent = judgeData.e.toFixed(2);
            document.getElementById('j-score-d').textContent = judgeData.d.toFixed(2);
            document.getElementById('j-e-deduction-display').value = judgeData.deductions.toFixed(2);
            document.getElementById('j-val-deduction').textContent = judgeData.deductions.toFixed(2);

            showToast('Önceki puanınız yüklendi. Düzenleyebilirsiniz.', 'info');
        } else {
            // Reset to default
            judgeData = { d: 0, e: 10, deductions: 0, totalMoves: {}, cv: 0, cr: 0 };
            document.getElementById('j-score-e').textContent = '10.00';
            document.getElementById('j-score-d').textContent = '0.00';
            document.getElementById('j-e-deduction-display').value = '';
            document.getElementById('j-val-deduction').textContent = '0.00';

        }

        // Reset selections UI
        document.querySelectorAll('.bonus-opt').forEach(b => b.classList.remove('selected'));

        // If loading previous scores, restore bonus selections
        if (previousScore) {
            // Restore CR selection
            const crBtn = document.querySelector(`#j-cr-options .bonus-opt[data-val="${previousScore.cr}"]`);
            if (crBtn) crBtn.classList.add('selected');

            // Restore CV selection
            const cvBtn = document.querySelector(`#j-cv-options .bonus-opt[data-val="${previousScore.cv}"]`);
            if (cvBtn) cvBtn.classList.add('selected');
        }

        // Setup D-Panel Mode (Standard vs Zorunlu vs Vault)
        const standardPanel = document.getElementById('j-panel-d-standard');
        const zorunluPanel = document.getElementById('j-panel-d-zorunlu');
        const vaultPanel = document.getElementById('j-panel-d-vault');

        // Auto-detect Zorunlu from title if flag not set
        let isZorunlu = currentActiveVideo.isZorunlu || false;
        const titleLower = (currentActiveVideo.title || '').toLowerCase();
        if (!isZorunlu && titleLower.includes('zorunlu')) {
            console.log('[JUDGE] Auto-detected Zorunlu from title');
            isZorunlu = true;
        }

        // Detect Vault (Atlama) - Robust Regex Check
        const rawApparatus = (currentActiveVideo.apparatus || '').trim();
        // Check for 'atlama', 'vault', 'masa', 'AtM' case-insensitive
        const isVault = /atlama|vault|masa|atm/i.test(rawApparatus);

        // VISUAL DEBUG: Add marker to header if detected
        if (isVault) document.getElementById('j-display-apparatus').textContent += ' (AT)';

        console.log('[JUDGE] Setup D-Panel. Video:', currentActiveVideo.title);
        console.log('[JUDGE] isZorunlu:', isZorunlu, 'isVault:', isVault);

        // Reset all specific d-panels
        if (standardPanel) standardPanel.style.display = 'none';
        if (zorunluPanel) zorunluPanel.style.display = 'none';
        if (vaultPanel) vaultPanel.style.display = 'none';

        const bonusSection = document.querySelector('.bonus-section');
        if (bonusSection) bonusSection.style.display = 'block'; // Default show

        if (isVault) {
            console.log('[JUDGE] Switching to Vault D-Score Mode');
            if (vaultPanel) vaultPanel.style.display = 'block';

            // Bonus Section (CR/CV/BTRS) is NOW allowed for Vault too
            if (bonusSection) bonusSection.style.display = 'block';

            // Restore Vault D-Score to display
            const vDisplay = document.getElementById('j-d-vault-display');
            if (vDisplay) {
                // If checking history, use vaultValue if exists, otherwise assume d was flat
                const storedVal = judgeData.vaultValue !== undefined ? judgeData.vaultValue : judgeData.d;
                vDisplay.value = storedVal > 0 ? storedVal : '';
                // Ensure judgeData has vaultValue set for future updates
                judgeData.vaultValue = storedVal;
            }

        } else if (isZorunlu) {
            console.log('[JUDGE] Switching to Zorunlu Mode UI (E-Score Style Deductions)');
            if (standardPanel) standardPanel.style.display = 'none';
            if (zorunluPanel) zorunluPanel.style.display = 'block';

            // Hide Bonus Section (CR/CV) explicitly
            const bonusSection = document.querySelector('.bonus-section');
            if (bonusSection) bonusSection.style.display = 'none';

            // Get expert D-score (maximum possible)
            const maxDScore = currentActiveVideo.expertD || 0;
            console.log('[JUDGE] Zorunlu maxDScore:', maxDScore); // DEBUG

            // Setup Zorunlu Panel with Direct D-Score Input (not deduction)
            zorunluPanel.innerHTML = `
                <div style="text-align:center; margin-bottom:20px">
                    <h4 style="color:var(--primary); margin-bottom:10px">Zorunlu Seri - D Puanı Girişi</h4>
                    <p style="font-size:0.85rem; color:var(--text-dim); margin-top:5px">D puanını girin</p>
                </div>
                
                <div class="e-input-container" style="margin-bottom:15px">
                    <input type="text" id="j-zorunlu-deduction-display" placeholder="0.00">
                </div>
                
                <div class="keypad numeric-keypad">
                    <button class="key-btn num-key-zorunlu" data-val="7">7</button>
                    <button class="key-btn num-key-zorunlu" data-val="8">8</button>
                    <button class="key-btn num-key-zorunlu" data-val="9">9</button>
                    <button class="key-btn num-key-zorunlu" data-val="4">4</button>
                    <button class="key-btn num-key-zorunlu" data-val="5">5</button>
                    <button class="key-btn num-key-zorunlu" data-val="6">6</button>
                    <button class="key-btn num-key-zorunlu" data-val="1">1</button>
                    <button class="key-btn num-key-zorunlu" data-val="2">2</button>
                    <button class="key-btn num-key-zorunlu" data-val="3">3</button>
                    <button class="key-btn clear-key" id="j-zorunlu-clear">SIL</button>
                    <button class="key-btn num-key-zorunlu" data-val="0">0</button>
                    <button class="key-btn num-key-zorunlu" data-val=".">.</button>
                </div>
                
                <div style="margin-top:15px; padding:10px; background:rgba(99, 102, 241, 0.1); border-radius:8px; text-align:center">
                    <span style="font-size:0.85rem; color:var(--text-dim)">D Puanı:</span>
                    <strong id="j-zorunlu-deduction-val" style="font-size:1.1rem; color:var(--success); margin-left:5px">0.00</strong>
                </div>
            `;

            console.log('[JUDGE] Zorunlu panel HTML created'); // DEBUG

            // Restore previous D-score if exists
            let previousDScore = 0;
            if (previousScore && previousScore.zorunluDeduction !== undefined) {
                previousDScore = previousScore.zorunluDeduction;
            }

            // Set initial values - D score is directly the entered value
            judgeData.zorunluDeduction = previousDScore;
            judgeData.d = previousDScore;

            const deductionDisplay = document.getElementById('j-zorunlu-deduction-display');
            const deductionVal = document.getElementById('j-zorunlu-deduction-val');

            if (previousDScore > 0) {
                deductionDisplay.value = previousDScore.toFixed(2);
                deductionVal.textContent = previousDScore.toFixed(2);
            }

            document.getElementById('j-score-d').textContent = judgeData.d.toFixed(2);

            console.log('[JUDGE] Setting up Zorunlu keypad listeners...'); // DEBUG

            // Setup keypad event listeners
            const zorunluKeys = document.querySelectorAll('.num-key-zorunlu');
            console.log('[JUDGE] Found', zorunluKeys.length, 'zorunlu keypad buttons'); // DEBUG

            zorunluKeys.forEach(btn => {
                btn.addEventListener('click', () => {
                    console.log('[JUDGE] Zorunlu key clicked:', btn.dataset.val); // DEBUG
                    const val = btn.dataset.val;
                    const display = document.getElementById('j-zorunlu-deduction-display');

                    if (!display) {
                        console.error('[JUDGE] Display element not found!');
                        return;
                    }

                    console.log('[JUDGE] Display element found:', display); // DEBUG
                    console.log('[JUDGE] Current display.value:', display.value); // DEBUG

                    if (val === '.' && display.value.includes('.')) return;

                    // If display is empty or '0', replace with the new value (unless it's a decimal point)
                    if ((display.value === '' || display.value === '0') && val !== '.') {
                        console.log('[JUDGE] Replacing value with:', val); // DEBUG
                        display.value = val;
                    } else {
                        console.log('[JUDGE] Appending value:', val); // DEBUG
                        display.value += val;
                    }

                    console.log('[JUDGE] Display value after assignment:', display.value); // DEBUG

                    // No max limit since Expert D might not be set
                    console.log('[JUDGE] Display value after update:', display.value); // DEBUG
                    updateZorunluDScore();
                });
            });

            const clearBtn = document.getElementById('j-zorunlu-clear');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    const display = document.getElementById('j-zorunlu-deduction-display');
                    if (display) {
                        display.value = '';
                        updateZorunluDScore();
                    }
                });
            }

            // Helper function to update D-score - D score IS the entered value
            window.updateZorunluDScore = () => {
                const input = document.getElementById('j-zorunlu-deduction-display').value;
                const dScore = input ? parseFloat(input) : 0;
                judgeData.zorunluDeduction = dScore;
                judgeData.d = dScore; // D score is directly the entered value

                document.getElementById('j-zorunlu-deduction-val').textContent = dScore.toFixed(2);
                document.getElementById('j-score-d').textContent = judgeData.d.toFixed(2);
            };

        } else {
            // STANDARD MODE (e.g. Paralel, Beam, Floor - D Score)
            console.log('[JUDGE] Switching to Standard Mode UI');

            // Show Standard Panel
            if (standardPanel) standardPanel.style.display = 'block';
            if (zorunluPanel) zorunluPanel.style.display = 'none';
            if (vaultPanel) vaultPanel.style.display = 'none';

            // Show Bonus Section
            const bonusSection = document.querySelector('.bonus-section');
            if (bonusSection) bonusSection.style.display = 'block';

            // Build Grid
            buildDifficultyGrid();
        }
    }

    window.calculateZorunluTotal = () => {
        let sum = 0;
        let moves = {};

        // Sum Toggle Buttons
        document.querySelectorAll('.z-toggle-btn.active').forEach(btn => {
            const val = parseFloat(btn.dataset.value);
            sum += val;
            moves[btn.dataset.key] = val;
        });

        // Sum Multi-Value Buttons
        document.querySelectorAll('.z-multi-btn.active').forEach(btn => {
            const val = parseFloat(btn.dataset.value);
            sum += val;
            moves[btn.dataset.key] = val;
        });

        // Sum Selects
        document.querySelectorAll('.z-d-input').forEach(input => {
            if (input.value) {
                const val = parseFloat(input.value);
                sum += val;
                moves[input.dataset.key] = val;
            }
        });

        // Update global judgeData
        if (judgeData) {
            judgeData.d = sum + (judgeData.cr || 0) + (judgeData.cv || 0);
            judgeData.totalMoves = moves;
            const dDisplay = document.getElementById('j-score-d');
            if (dDisplay) dDisplay.textContent = judgeData.d.toFixed(2);
        }
    };

    function buildDifficultyGrid() {
        const grid = document.getElementById('j-diff-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const levels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

        levels.forEach(lvl => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<th style="width:30px; font-weight:800; color:var(--primary-light); font-size:0.8rem;">${lvl}</th>`;
            const td = document.createElement('td');
            td.style.padding = '4px';
            const btnGroup = document.createElement('div');
            btnGroup.style.display = 'flex';
            btnGroup.style.justifyContent = 'space-between';
            btnGroup.style.gap = '2px';

            // Get previous count for this level
            const previousCount = judgeData.totalMoves[lvl] || 0;

            for (let i = 0; i <= 8; i++) {
                const btn = document.createElement('button');
                btn.className = 'grid-move-btn';
                btn.id = `btn-${lvl}-${i}`;
                btn.textContent = i;

                btn.onclick = () => selectLvlCount(lvl, i);
                // Select based on previous data or default to 0
                if (i === previousCount) {
                    btn.classList.add('selected');
                }
                btnGroup.appendChild(btn);
            }
            td.appendChild(btnGroup);
            tr.appendChild(td);
            grid.appendChild(tr);
        });
    }

    window.selectLvlCount = (lvl, count) => {
        // Reset row
        for (let i = 0; i <= 8; i++) {
            document.getElementById(`btn-${lvl}-${i}`).classList.remove('selected');
        }
        document.getElementById(`btn-${lvl}-${count}`).classList.add('selected');
        judgeData.totalMoves[lvl] = count;
        updateJudgeD();
    };

    function resetJudgeUI() {
        const playerTarget = document.getElementById('player-target');
        if (playerTarget) {
            playerTarget.innerHTML = `
                <div class="waiting-area">
                    <div class="pulse-icon">📡</div>
                    <h3>Admin Yayını Başlatması Bekleniyor...</h3>
                </div>
            `;
        }

        // Reset scores to default
        document.getElementById('j-score-d').textContent = '0.00';
        document.getElementById('j-score-e').textContent = '10.00';
    }

    // --- EXPERT SCORE RECALCULATION ---
    window.recalculateJudgeScores = async (videoId, newExpertD, newExpertE) => {
        try {
            console.log(`[DEBUG] Recalculating for video ${videoId} with ExpertD: ${newExpertD}, ExpertE: ${newExpertE}`); // DEBUG
            showToast('Hakem puanları yeniden hesaplanıyor...', 'info');

            // Get all results for this video
            const snapshot = await db.ref('old/results')
                .orderByChild('videoId')
                .equalTo(videoId)
                .once('value');

            if (!snapshot.exists()) {
                console.log('[DEBUG] No results found for this video'); // DEBUG
                showToast('Bu video için puan bulunamadı.', 'info');
                return;
            }

            const results = snapshot.val();
            let updateCount = 0;
            const updates = {};

            // Recalculate deviation and points for each result
            Object.entries(results).forEach(([resultId, result]) => {
                let newDeviation = 0;
                let newPoints = 0;

                // Determine judge type based on which score they gave
                // Fix: Check if d is defined, not just > 0 (because 0 is a valid score)
                const isDJudge = (result.type === 'D') || (result.d !== undefined && result.d !== null);

                console.log(`[DEBUG] Result ${resultId}: JudgeType=${isDJudge ? 'D' : 'E'}, ResultD=${result.d}, ResultE=${result.e}`); // DEBUG

                if (isDJudge) {
                    // D-score judge
                    newDeviation = Math.abs(result.d - newExpertD);
                    console.log(`[DEBUG] D-Calc: |${result.d} - ${newExpertD}| = ${newDeviation}`); // DEBUG
                    // Calculate points: 1.0 - (deviation * 2)
                    newPoints = Math.max(0, 1.0 - (newDeviation * 2));
                } else {
                    // E-score judge
                    newDeviation = Math.abs(result.e - newExpertE);
                    // Calculate points based on Matrix
                    // We need to round deviation to 1 decimal for matrix key lookup
                    const roundedDeviation = Math.round(newDeviation * 10) / 10;
                    const expertVal = Math.round(newExpertE * 10) / 10;
                    const rowKey = expertVal.toFixed(1);
                    const diffKey = roundedDeviation.toFixed(1);

                    if (window.getMatrixValue) {
                        newPoints = window.getMatrixValue(rowKey, diffKey);
                    } else {
                        // Fallback simple calculation if matrix helper missing
                        newPoints = Math.max(0, 1.0 - (newDeviation * 2));
                    }
                }

                // Update if deviation or points changed
                if (result.dev !== newDeviation || result.points !== newPoints) {
                    updates[`results/${resultId}/dev`] = newDeviation;
                    updates[`results/${resultId}/points`] = newPoints;
                    updateCount++;
                }
            });

            // Apply all updates
            if (updateCount > 0) {
                await db.ref().update(updates);
                showToast(`${updateCount} hakem puanı güncellendi!`, 'success');
            } else {
                showToast('Güncellenecek puan bulunamadı.', 'info');
            }

        } catch (error) {
            console.error('Recalculation error:', error);
            showToast('Yeniden hesaplama hatası!', 'error');
        }
    };

    // --- UTILITIES ---
    function showScreen(id) {
        Object.values(screens).forEach(s => {
            if (s) s.style.display = 'none';
        });
        if (screens[id]) {
            screens[id].style.display = 'block';
        } else if (id === 'admin-auth' && screens['auth']) {
            // Fallback for index.html which has admin-auth inside auth
            screens['auth'].style.display = 'block';
            const adminArea = document.getElementById('admin-auth-area');
            const judgeArea = document.getElementById('judge-auth-area');
            if (adminArea) adminArea.style.display = 'block';
            if (judgeArea) judgeArea.style.display = 'none';
        }
    }

    window.deleteVideo = async (key) => { if (await showConfirm('Silinsin mi?')) db.ref('old/videos/' + key).remove(); };
    window.deleteReferee = async (key) => { if (await showConfirm('Hakem silinsin mi?')) db.ref('old/referees/' + key).remove(); };
    window.copyToClipboard = (text) => { navigator.clipboard.writeText(text); showToast('Metin Kopyalandı!'); };
    window.copyMagicLink = (token) => {
        const link = `${window.location.origin}/index.html?token=${token}`;
        navigator.clipboard.writeText(link);
        showToast('Giriş Linki Kopyalandı!');
    };

    window.editParameters = async (key) => {
        const snap = await db.ref('old/videos/' + key).once('value');
        const v = snap.val();
        const newD = await showPrompt('Yeni Uzman D Puanı:', v.expertD);
        const newE = await showPrompt('Yeni Uzman E Puanı:', v.expertE);

        if (newD !== null && newE !== null) {
            db.ref('old/videos/' + key).update({
                expertD: parseFloat(newD),
                expertE: parseFloat(newE)
            });
            showToast('Parametreler güncellendi.');
        }
    };

    window.toggleHistory = (groupKey) => {
        const row = document.getElementById(`history-${groupKey}`);
        if (row) {
            row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
        }
    };

    window.setValidScore = async (resultId, videoId, refereeId) => {
        const snap = await db.ref('old/results').once('value');
        const updates = {};
        snap.forEach(child => {
            const r = child.val();
            if (r.videoId === videoId && r.refereeId === refereeId) {
                updates[`results/${child.key}/isValid`] = (child.key === resultId);
            }
        });
        db.ref().update(updates);
        showToast('Seçilen puan geçerli kılındı.', 'success');
    };

    window.sendEmail = async (refKey) => {
        const snap = await db.ref('old/referees/' + refKey).once('value');
        const r = snap.val();
        const link = `${window.location.origin}${window.location.pathname}?token=${r.token}`;

        // Bu bölüm için EmailJS veya benzeri bir servis kullanılması önerilir.
        // Demo amaçlı şimdilik mailto linki açar veya bir servis çağrısı simüle eder.
        console.log(`Email gönderiliyor: ${r.email} - Link: ${link}`);

        const mailBody = `Merhaba ${r.name},\n\nWAG Hakem Sınavı'na giriş yapmak için lütfen aşağıdaki linke tıklayınız:\n\n${link}\n\nBaşarılar dileriz.`;
        window.open(`mailto:${r.email}?subject=WAG Hakem Sınavı Giriş Linki&body=${encodeURIComponent(mailBody)}`);

        showToast(`${r.email} adresine mail taslağı oluşturuldu.`, 'info');
    };

    window.updateApparatusOptions = (selectId, discipline) => {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = '';
        const options = discipline === 'WAG'
            ? [{ v: 'AtM', t: 'Atlama Masası' }, { v: 'KP', t: 'Kız Paraleli' }, { v: 'D', t: 'Denge' }, { v: 'Y', t: 'Yer' }]
            : [{ v: 'Y', t: 'Yer' }, { v: 'KB', t: 'Kulplu Beygir' }, { v: 'H', t: 'Halkalar' }, { v: 'AtM', t: 'Atlama Masası' }, { v: 'PB', t: 'Paralel Bar' }, { v: 'B', t: 'Barfiks' }];

        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.v;
            el.textContent = opt.t;
            select.appendChild(el);
        });
    };

    // Global Discipline Sync for Admin
    const globalDiscSelect = document.getElementById('active-discipline-select');
    if (globalDiscSelect) {
        globalDiscSelect.addEventListener('change', () => {
            // Trigger UI update manually instead of reload
            const activeDiscipline = globalDiscSelect.value;

            // Refresh Video List
            renderVideoList();

            // Re-initialize apparatus for the add video form
            const vDisc = document.getElementById('v-discipline');
            if (vDisc) vDisc.value = activeDiscipline;
            updateApparatusOptions('v-apparatus', activeDiscipline);
        });
    }

    function getEmbedUrl(url) {
        if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
        if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
        return url;
    }



    // --- TOAST & MODAL IMPLEMENTATION ---

    window.parseExpertDetail = function (detailStr) {
        // Parses "4D - 3C - 1B\nCR 2.00\nCV 0.1" into an object
        const result = {
            moves: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
            cr: 0,
            cv: 0, // Bonus/CV + DmT?
            btrs: 0
        };

        if (!detailStr) return result;

        // Split by lines or newlines to separate Moves, CR, CV
        const parts = detailStr.split(/[\n\r]+/);

        parts.forEach(part => {
            part = part.trim();
            if (!part) return;

            // Check for CR
            if (part.startsWith('CR') || part.startsWith('KG')) {
                // "CR 2.00" or "KG 2.00"
                const match = part.match(/[0-9.]+/);
                if (match) result.cr = parseFloat(match[0]);
            }
            // Check for CV / Bonus / DmT
            else if (part.includes('CV') || part.includes('DmT')) {
                // "CV 0.2 - DmT 0.2" -> Sum simple numbers
                const numbers = part.match(/[0-9.]+/g);
                if (numbers) {
                    numbers.forEach(n => result.cv += parseFloat(n));
                }
            }
            // Assume Moves (e.g. "4D - 3C - 1B" or "8D")
            else {
                // Split by dash if exists, else space?
                // "1E - 2D - 5C"
                const segments = part.split('-');
                segments.forEach(seg => {
                    const match = seg.match(/(\d+)([A-Z])/); // 4D
                    if (match) {
                        const count = parseInt(match[1]);
                        const group = match[2];
                        if (result.moves[group] !== undefined) {
                            result.moves[group] += count; // Add? Usually unique per line but "8D"
                        }
                    }
                });
            }
        });

        return result;
    };

    function showToast(message, type = 'success') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = '🔔';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'info') icon = 'ℹ️';

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideInToast 0.3s ease-in reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function showConfirm(message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal-card">
                    <h3>Onay Gerekli</h3>
                    <p>${message}</p>
                    <div class="modal-actions">
                        <button class="reset-btn" id="modal-cancel">İptal</button>
                        <button class="primary-btn" id="modal-confirm">Onayla</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('modal-cancel').onclick = () => { overlay.remove(); resolve(false); };
            document.getElementById('modal-confirm').onclick = () => { overlay.remove(); resolve(true); };
        });
    }

    function showPrompt(message, defaultValue = '') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal-card">
                    <h3>Giriş Gerekli</h3>
                    <p>${message}</p>
                    <input type="text" class="modal-input" id="modal-prompt-input" value="${defaultValue}">
                    <div class="modal-actions">
                        <button class="reset-btn" id="modal-cancel">İptal</button>
                        <button class="primary-btn" id="modal-confirm">Tamam</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const input = document.getElementById('modal-prompt-input');
            input.focus();
            input.select();

            document.getElementById('modal-cancel').onclick = () => { overlay.remove(); resolve(null); };
            document.getElementById('modal-confirm').onclick = () => {
                const val = input.value;
                overlay.remove();
                resolve(val);
            };

            input.onkeydown = (e) => {
                if (e.key === 'Enter') document.getElementById('modal-confirm').click();
                if (e.key === 'Escape') document.getElementById('modal-cancel').click();
            };
        });
    }



    // Helper for Add Video Form
    window.toggleZorunluAddInputs = () => {
        const isChecked = document.getElementById('v-is-zorunlu').checked;
        const container = document.getElementById('zorunlu-add-inputs-container');
        if (container) {
            container.style.display = isChecked ? 'block' : 'none';
        }
    };

});

// --- RESULTS MATRIX LOGIC ---

window.getMatrixValue = function (rowKey, devKey) {
    // Ensure keys are formatted correctly (1 decimal place)
    const rKey = parseFloat(rowKey).toFixed(1);
    const dKey = parseFloat(devKey).toFixed(1);

    // Check overrides first
    const overrideKey = rKey.replace('.', '_');
    if (window.globalSettings && window.globalSettings.matrixOverrides && window.globalSettings.matrixOverrides[overrideKey] && window.globalSettings.matrixOverrides[overrideKey][dKey] !== undefined) {
        return window.globalSettings.matrixOverrides[overrideKey][dKey];
    }

    // Use new SCORING_MATRIX (from scoring_config.js) if available
    if (window.SCORING_MATRIX) {
        const row = window.SCORING_MATRIX[rKey] || window.SCORING_MATRIX["0.0"];
        return row[dKey] !== undefined ? row[dKey] : 0;
    }

    // Fallback to legacy TABLO_E if SCORING_MATRIX not loaded
    if (typeof TABLO_E !== 'undefined') {
        const row = TABLO_E[rKey] || TABLO_E["0.0"];
        return row && row[dKey] !== undefined ? row[dKey] : 0;
    }

    return 0;
};

let matrixData = {
    videos: [],
    results: {},
    referees: [],
    exams: []
};
let activeMatrixTab = 'zorunlu'; // 'zorunlu' | 'serbest'

window.switchMatrixTab = function (tab) {
    activeMatrixTab = tab;
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-matrix-${tab}`).classList.add('active');
    renderMatrixTable();
};

window.loadResultsMatrix = async function () {
    const loading = document.getElementById('matrix-loading');
    const empty = document.getElementById('matrix-empty');
    const table = document.getElementById('results-matrix-table');

    if (loading) loading.style.display = 'block';
    if (table) table.innerHTML = '';
    if (empty) empty.style.display = 'none';

    try {
        // Fetch Data in Parallel
        const [vSnap, rSnap, refSnap, eSnap] = await Promise.all([
            db.ref('old/videos').once('value'),
            db.ref('old/results').once('value'),
            db.ref('old/referees').once('value'),
            db.ref('old/exams').once('value')
        ]);

        const videosObj = vSnap.val() || {};
        const resultsObj = rSnap.val() || {}; // Flatten this later
        const refereesObj = refSnap.val() || {};
        const examsObj = eSnap.val() || {};

        // Fix: Use Object.entries to preserve keys as IDs
        matrixData.videos = Object.entries(videosObj).map(([k, v]) => ({ id: k, ...v }));
        matrixData.referees = Object.entries(refereesObj).map(([k, v]) => ({ key: k, ...v })); // Referees usually use 'key' property in this app
        matrixData.exams = Object.entries(examsObj).map(([k, v]) => ({ id: k, ...v }));

        // Populate Exam Filter
        const examFilter = document.getElementById('matrix-filter-exam');
        if (examFilter) {
            examFilter.innerHTML = '<option value="">Tüm Sınavlar</option>';
            matrixData.exams.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = e.name;
                examFilter.appendChild(opt);
            });
        }

        // Flatten results: Map<VideoId, Map<RefereeId, Result>>
        matrixData.results = {}; // Reset

        const rawResults = [];

        const traverse = (obj) => {
            if (!obj) return;
            Object.keys(obj).forEach(key => {
                const val = obj[key];
                if (!val) return;

                if (val.d !== undefined || val.points !== undefined || val.refereeId || val.zorunluDeduction !== undefined) {
                    // It's a result object if it has refereeId and videoId
                    if (val.refereeId && val.videoId) {
                        rawResults.push(val);
                    }
                } else if (typeof val === 'object') {
                    traverse(val);
                }
            });
        };
        traverse(resultsObj);

        // Index results: matrixData.results[refereeId][videoId] = result
        matrixData.results = {};
        rawResults.forEach(r => {
            if (!matrixData.results[r.refereeId]) matrixData.results[r.refereeId] = {};
            matrixData.results[r.refereeId][r.videoId] = r;
        });

        console.log('[MATRIX] Data Loaded. Videos:', matrixData.videos.length, 'Refs:', matrixData.referees.length, 'Results:', rawResults.length);

        renderMatrixTable();

    } catch (err) {
        console.error('Matrix load error:', err);
        showToast('Veri yüklenirken hata oluştu.', 'error');
    } finally {
        if (loading) loading.style.display = 'none';
    }
};

window.renderMatrixTable = function () {
    const table = document.getElementById('results-matrix-table');
    const empty = document.getElementById('matrix-empty');
    const examIdFilter = document.getElementById('matrix-filter-exam').value;
    const apparatusFilter = document.getElementById('matrix-filter-apparatus').value;

    if (!table) return;
    table.innerHTML = '';

    // 1. Filter Videos (Columns)
    let visibleVideos = matrixData.videos.filter(v => {
        // Tab Filter (Zorunlu/Serbest) logic
        const parentExam = matrixData.exams.find(e => e.id === v.examId);

        // Strict Tab Check
        // If tab is 'zorunlu', exam MUST have 'Zorunlu' in name OR title has it.
        // If tab is 'serbest', exam MUST have 'Serbest' in name OR title.

        const examName = (parentExam ? parentExam.name : '').toLowerCase();
        const videoTitle = (v.title || '').toLowerCase();
        const discipline = (v.discipline || '').toLowerCase(); // 'WAG' / 'MAG'

        const isZorunlu = examName.includes('zorunlu') || videoTitle.includes('zorunlu');
        const isSerbest = examName.includes('serbest') || videoTitle.includes('serbest');

        if (activeMatrixTab === 'zorunlu' && !isZorunlu) return false;
        // If Serbest tab, exclude if it is explicitly zorunlu, OR require it to be serbest?
        // Let's say: Serbest tab shows "Serbest" content.
        if (activeMatrixTab === 'serbest' && isZorunlu) return false;

        if (examIdFilter && v.examId !== examIdFilter) return false;
        if (apparatusFilter && v.apparatus !== apparatusFilter) return false;
        return true;
    });

    // Sort videos by Apparatus -> Title
    const appOrder = { 'AtM': 1, 'KP': 2, 'D': 3, 'Y': 4 };
    visibleVideos.sort((a, b) => {
        const apA = appOrder[a.apparatus] || 99;
        const apB = appOrder[b.apparatus] || 99;
        if (apA !== apB) return apA - apB;
        return a.title.localeCompare(b.title);
    });

    if (visibleVideos.length === 0) {
        if (empty) empty.style.display = 'block';
        empty.textContent = 'Bu kriterlere uygun video/hareket bulunamadı. Lütfen filtreleri kontrol edin.';
        return;
    }

    // 2. Filter Referees (Rows)
    // IMPORTANT FIX: Do NOT filter referees by 'examType'. 
    // Filter them only if they have NO data for the visible videos.
    // We start with ALL referees.

    let visibleReferees = [...matrixData.referees];

    // Calculate Stats & Filter by Participation
    const finalReferees = [];

    visibleReferees.forEach(r => {
        let totalDeviation = 0;
        let count = 0;
        const refResults = matrixData.results[r.key] || {};

        visibleVideos.forEach(v => {
            const res = refResults[v.id];
            if (res) {
                // Deviation calculation
                let isDJudge = false;

                // 1. Explicit Type (if saved)
                if (res.type === 'D') isDJudge = true;
                else if (res.type === 'E') isDJudge = false;
                else {
                    // 2. Implicit heuristics
                    if (res.d !== undefined && res.d !== null && res.d > 0) {
                        isDJudge = true;
                    }
                    // 3. Context fallback (if D is 0)
                    // If the video itself is strictly defined as 'D' type (e.g. Zorunlu series D panel only),
                    // then we assume it's a D judge even if score is 0.
                    else if (v.type === 'D') {
                        isDJudge = true;
                    }
                }

                const expertVal = isDJudge ? v.expertD : v.expertE;
                const judgeVal = isDJudge ? res.d : res.e;

                let dev = Math.abs((judgeVal || 0) - (expertVal || 0));
                totalDeviation += dev;
                count++;
            }
        });

        r._stats = {
            avgDeviation: count > 0 ? (totalDeviation / count) : 999,
            accuracy: count > 0 ? (100 - (totalDeviation * 10)) : 0,
            matchCount: count
        };

        // Only include if they have at least one valid score in this view
        if (count > 0) {
            finalReferees.push(r);
        }
    });

    // Sort by Accuracy
    finalReferees.sort((a, b) => a._stats.avgDeviation - b._stats.avgDeviation);

    if (finalReferees.length === 0) {
        if (empty) empty.style.display = 'block';
        empty.textContent = 'Bu seriler için puan girmiş hakem bulunamadı.';
        return;
    }

    // 3. Build Table HTML
    let thead = '<thead><tr><th style="position:sticky; left:0; z-index:10; background:var(--surface-dark); border-right:1px solid var(--glass-border); min-width:200px">Hakem</th>';
    visibleVideos.forEach(v => {
        thead += `<th style="min-width:120px; font-size:0.8rem">${v.apparatus}<br>${v.title}</th>`;
    });
    thead += '</tr></thead>';

    let tbody = '<tbody>';
    finalReferees.forEach(r => {
        let row = `<tr>
            <td style="position:sticky; left:0; z-index:5; background:var(--surface); border-right:1px solid var(--glass-border); font-weight:600">
                <div>${r.name}</div>
                <div style="font-size:0.75rem; color:var(--text-dim); font-weight:normal">
                    Ort. Sapma: ${r._stats.avgDeviation === 999 ? '-' : r._stats.avgDeviation.toFixed(2)}
                </div>
            </td>`;

        const refResults = matrixData.results[r.key] || {};

        visibleVideos.forEach(v => {
            const res = refResults[v.id];
            if (res) {
                let isDJudge = false;
                if (res.type === 'D') isDJudge = true;
                else if (res.type === 'E') isDJudge = false;
                else {
                    if (res.d !== undefined && res.d !== null && res.d > 0) isDJudge = true;
                    else if (v.type === 'D') isDJudge = true;
                }
                const label = isDJudge ? 'D' : 'E';
                const val = isDJudge ? res.d : res.e;
                const expertVal = isDJudge ? v.expertD : v.expertE;
                const dev = Math.abs((val || 0) - (expertVal || 0));

                let color = 'var(--text)';
                if (dev === 0) color = '#10b981';
                else if (dev < 0.5) color = '#f59e0b';
                else color = '#ef4444';

                row += `<td style="text-align:center; border-right:1px solid rgba(255,255,255,0.05)">
                    <div style="font-weight:bold">${label}: ${val}</div>
                    <div style="font-size:0.75rem; color:${color}">Sapma: ${dev.toFixed(2)}</div>
                </td>`;
            } else {
                row += `<td style="text-align:center; color:var(--text-dim)">-</td>`;
            }
        });

        row += '</tr>';
        tbody += row;
    });
    tbody += '</tbody>';

    table.innerHTML = thead + tbody;
    if (empty) empty.style.display = 'none';
};


window.exportMatrixToExcel = function () {
    const loading = document.getElementById('matrix-loading');
    if (loading) loading.style.display = 'block';

    setTimeout(() => {
        try {
            // 1. Re-run Filtering Logic
            const examIdFilter = document.getElementById('matrix-filter-exam').value;
            const apparatusFilter = document.getElementById('matrix-filter-apparatus').value;

            let visibleVideos = matrixData.videos.filter(v => {
                const parentExam = matrixData.exams.find(e => e.id === v.examId);
                const examName = (parentExam ? parentExam.name : '').toLowerCase();
                const videoTitle = (v.title || '').toLowerCase();
                const isZorunlu = examName.includes('zorunlu') || videoTitle.includes('zorunlu');

                if (activeMatrixTab === 'zorunlu' && !isZorunlu) return false;
                if (activeMatrixTab === 'serbest' && isZorunlu) return false;
                if (examIdFilter && v.examId !== examIdFilter) return false;
                if (apparatusFilter && v.apparatus !== apparatusFilter) return false;
                return true;
            });

            // Sort: Apparatus -> Title
            const appOrder = { 'AtM': 1, 'KP': 2, 'D': 3, 'Y': 4 };
            visibleVideos.sort((a, b) => {
                const apA = appOrder[a.apparatus] || 99;
                const apB = appOrder[b.apparatus] || 99;
                if (apA !== apB) return apA - apB;
                // Numeric Sort for Titles (e.g. "Atlama 2" before "Atlama 10")
                return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
            });

            // Filter Referees
            let visibleReferees = [...matrixData.referees];
            const finalReferees = [];

            // ALSO PREPARE DETAIL DATA
            const detailData = [];

            visibleReferees.forEach(r => {
                let totalDeviation = 0;
                let count = 0;
                const refResults = matrixData.results[r.key] || {};

                visibleVideos.forEach(v => {
                    const res = refResults[v.id];
                    if (res) {
                        let isDJudge = false;
                        if (res.type === 'D') isDJudge = true;
                        else if (res.type === 'E') isDJudge = false;
                        else {
                            // Check for D-score (serbest) OR zorunluDeduction (zorunlu)
                            if ((res.d !== undefined && res.d !== null && res.d > 0) ||
                                (res.zorunluDeduction !== undefined && res.zorunluDeduction > 0)) isDJudge = true;
                            else if (v.type === 'D') isDJudge = true;
                        }
                        const expertVal = isDJudge ? (v.expertD || 0) : (v.expertE || 0);
                        // For Zorunlu, use zorunluDeduction; otherwise use d or e
                        const judgeVal = isDJudge ? (res.zorunluDeduction || res.d || 0) : (res.e || 0);
                        const dev = Math.abs((judgeVal || 0) - (expertVal || 0));
                        totalDeviation += dev;
                        count++;

                        const rowK = expertVal.toFixed(1);
                        const devK = dev.toFixed(1);
                        const matrixScore = getMatrixValue(rowK, devK); // returns 0.0 - 1.0
                        let acc = matrixScore * 100;
                        if (acc < 0) acc = 0;

                        // Add to Detail Data
                        detailData.push({
                            "Hakem Adı": r.name,
                            "Video": v.title,
                            "Alet": v.apparatus,
                            "Panel": isDJudge ? "D" : "E",
                            "Hakem Puanı": parseFloat(judgeVal || 0),
                            "Uzman Puanı": parseFloat(expertVal || 0),
                            "Sapma": parseFloat(dev.toFixed(2)),
                            "Başarı (%)": parseFloat(acc.toFixed(2)),
                            "Tarih": new Date(res.timestamp).toLocaleDateString("tr-TR")
                        });
                    }
                });

                r._stats = {
                    avgDeviation: count > 0 ? (totalDeviation / count) : 999
                };
                if (count > 0) finalReferees.push(r);
            });
            finalReferees.sort((a, b) => a._stats.avgDeviation - b._stats.avgDeviation);

            // Helper: Calculate Expert D Score & Success %
            const calculateExpertDScore = (v, res) => {
                let successPct = 0;
                let expertTotalD = 0;

                const isVault = (v.apparatus === 'AtM' || v.apparatus === 'Atlama Masası');

                // Get Expert Data
                let expertData = { moves: {}, kg: 0, bd: 0, totalD: 0 };

                // Find Index
                // Note: We need a reliable way to find the index 1-5 like we did in export logic
                // Here we might just find it by sorted index logic again?
                // Or maybe we use the 'expertD' string if available?
                // Ideally we should reuse the same logic. 
                // Let's iterate EXPERT_SERBEST_DATA directly to match video?
                // For simplicity here, let's assume we can match by index if we sort videos by apparatus.
                // But visibleVideos might be mixed.
                // Let's use the same appCode map logic.

                const appCodeMap = { 'Kız Paraleli': 'KP', 'Denge': 'D', 'Yer': 'Y', 'Atlama Masası': 'AtM' };
                const appCode = appCodeMap[v.apparatus] || v.apparatus;

                // Find this video's index within its apparatus kind in the visible list
                // This is expensive inside a loop but safe
                const sameAppVideos = visibleVideos.filter(vid => vid.apparatus === v.apparatus);
                const vIndex = sameAppVideos.findIndex(vid => vid.id === v.id) + 1;

                if (window.EXPERT_SERBEST_DATA && window.EXPERT_SERBEST_DATA[appCode] && window.EXPERT_SERBEST_DATA[appCode][vIndex]) {
                    const ex = window.EXPERT_SERBEST_DATA[appCode][vIndex];
                    if (ex.d) {
                        expertData.totalD = ex.d;
                    } else {
                        expertData.moves = ex.moves || {};
                        expertData.kg = ex.kg || 0;
                        expertData.bd = ex.bd || 0;
                        // Calculate Total D
                        let calcD = 0;
                        const weights = { 'A': 0.1, 'B': 0.2, 'C': 0.3, 'D': 0.4, 'E': 0.5, 'F': 0.6, 'G': 0.7, 'H': 0.8, 'I': 0.9, 'J': 1.0 };
                        Object.entries(expertData.moves).forEach(([key, count]) => {
                            calcD += (count * (weights[key] || 0));
                        });
                        calcD += expertData.kg;
                        calcD += expertData.bd;
                        expertData.totalD = parseFloat(calcD.toFixed(2));
                    }
                } else if (v.isZorunlu && v.expertDMoves) {
                    // ZORUNLU: Calculate expert total from v.expertDMoves
                    let zorunluTotal = 0;
                    Object.values(v.expertDMoves).forEach(val => {
                        if (Array.isArray(val)) {
                            // Multiple values - use average or sum? Use max for expected D
                            zorunluTotal += Math.max(...val.filter(n => !isNaN(n)));
                        } else if (!isNaN(parseFloat(val))) {
                            zorunluTotal += parseFloat(val);
                        }
                    });
                    expertData.totalD = zorunluTotal;
                } else {
                    // Fallback if data missing (e.g. standard legacy)
                    expertData.totalD = parseFloat(v.expertD || 0);
                }

                expertTotalD = parseFloat(expertData.totalD || 0);
                // For Zorunlu, D-score is stored in zorunluDeduction field
                const userTotalD = parseFloat(res.zorunluDeduction || res.d || 0);

                let totalPenalty = 0;

                if (isVault) {
                    if (Math.abs(userTotalD - expertTotalD) < 0.001) {
                        totalPenalty = 0;
                    } else {
                        totalPenalty = 1.0;
                    }
                } else {
                    const bd = res.breakdown || res.totalMoves || {};
                    const userKG = parseFloat(res.cr || 0);
                    const userBD = parseFloat(res.cv || 0) + parseFloat(res.btrs || 0);

                    // 1. Move Count Penalties
                    const keys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
                    keys.forEach(key => {
                        const uCount = bd[key] || 0;
                        const eCount = expertData.moves[key] || 0;
                        totalPenalty += Math.abs(uCount - eCount) * 0.1;
                    });

                    // 2. KG Penalty
                    const expertKG = expertData.kg || 0;
                    totalPenalty += Math.abs(userKG - expertKG) * 0.1;

                    // 3. BD Penalty 
                    const expertBD = expertData.bd || 0;
                    totalPenalty += Math.abs(userBD - expertBD) * 1.0;
                }

                const successScore = 1.0 - totalPenalty;
                successPct = (successScore * 100);

                // Rule: If result is negative, floor it at 0.
                if (successPct < 0) successPct = 0;

                return successPct;
            };

            // 2. Prepare Summary Data
            const summaryData = finalReferees.map(r => {
                const stats = {
                    'AtM': { E: { sum: 0, count: 0 }, D: { sum: 0, count: 0 } },
                    'KP': { E: { sum: 0, count: 0 }, D: { sum: 0, count: 0 } },
                    'D': { E: { sum: 0, count: 0 }, D: { sum: 0, count: 0 } },
                    'Y': { E: { sum: 0, count: 0 }, D: { sum: 0, count: 0 } },
                    // Grand Totals
                    'Total': { E: { sum: 0, count: 0 }, D: { sum: 0, count: 0 } }
                };

                const refResults = matrixData.results[r.key] || {};
                visibleVideos.forEach(v => {
                    const res = refResults[v.id];
                    if (res) {
                        let isDJudge = false;
                        if (res.type === 'D') isDJudge = true;
                        else if (res.type === 'E') isDJudge = false;
                        else {
                            // Check for D-score (serbest) OR zorunluDeduction (zorunlu)
                            if ((res.d !== undefined && res.d !== null && res.d > 0) ||
                                (res.zorunluDeduction !== undefined && res.zorunluDeduction > 0)) isDJudge = true;
                            else if (v.type === 'D') isDJudge = true;
                        }

                        let acc = 0;

                        if (isDJudge) {
                            // NEW Logic for D-Score Summary
                            acc = calculateExpertDScore(v, res);
                        } else {
                            // Standard Matrix Logic for E-Score
                            const expertVal = v.expertE;
                            const judgeVal = res.e;
                            const dev = Math.abs((judgeVal || 0) - (expertVal || 0));
                            const rowK = parseFloat(expertVal || 0).toFixed(1);
                            const devK = dev.toFixed(1);
                            const matrixScore = getMatrixValue(rowK, devK); // returns 0.0 - 1.0
                            acc = matrixScore * 100;
                            if (acc < 0) acc = 0;
                        }

                        const bucket = stats[v.apparatus];
                        const totalBucket = stats['Total'];
                        if (bucket) {
                            const type = isDJudge ? 'D' : 'E';
                            bucket[type].sum += acc;
                            bucket[type].count++;
                            // Add to Total
                            totalBucket[type].sum += acc;
                            totalBucket[type].count++;
                        }
                    }
                });

                const getAvg = (app, type) => {
                    const s = stats[app][type];
                    // Strict Denominators based on Logic:
                    // AtM: 10 videos max. If user graded 8, we still divide by 10 for absolute % representation?
                    // User said: "10 var hakem 8 değerlendirmişse 10'a bölmen lazım" (If there are 10, judge graded 8, divide by 10).
                    // This implies the denominator is the TOTAL POSSIBLE videos, not graded count.
                    // AtM: 10 videos.
                    // KP, D, Y: 5 videos each.
                    // Total: 10+5+5+5 = 25 videos.

                    let denominator = 1;
                    if (app === 'AtM') {
                        // Special Rule for Atlama:
                        // D-Score: Divide by 10 (10 possible vaults?)
                        // E-Score: Divide by 5 (Requested by user)
                        if (type === 'E') denominator = 5;
                        else denominator = 10;
                    }
                    else if (app === 'Total') denominator = 25;
                    else denominator = 5; // KP, D, Y

                    // Return Average %
                    // s.sum contains Sum of Percentages
                    return (s.sum / denominator);
                };

                const atmE = getAvg('AtM', 'E') || 0;
                const atmD = getAvg('AtM', 'D') || 0;
                const kpE = getAvg('KP', 'E') || 0;
                const kpD = getAvg('KP', 'D') || 0;
                const dE = getAvg('D', 'E') || 0;
                const dD = getAvg('D', 'D') || 0;
                const yE = getAvg('Y', 'E') || 0;
                const yD = getAvg('Y', 'D') || 0;

                // Total Calculation: Average of 4 Apparatuses (Not Weighted)
                const tE = (atmE + kpE + dE + yE) / 4;
                const tD = (atmD + kpD + dD + yD) / 4;

                const overallScore = (tE + tD) / 2;

                return {
                    firstName: r.firstName || r.name.split(' ').slice(0, -1).join(' ') || r.name,
                    lastName: r.lastName || r.name.split(' ').pop(),
                    atm_e: atmE, atm_d: atmD,
                    kp_e: kpE, kp_d: kpD,
                    d_e: dE, d_d: dD,
                    y_e: yE, y_d: yD,
                    tot_e: tE, tot_d: tD,
                    overall: overallScore
                };
            });

            // Sort by Overall Score Descending
            summaryData.sort((a, b) => b.overall - a.overall);

            // 3. Build Sheet 1 (Summary)
            const ws_data = [];
            // Headers
            // 4 cols per apparatus: E%, Not, D%, Not
            const header2 = ["", "", "", "Atlama", "", "", "", "Asimetrik Paralel", "", "", "", "Denge", "", "", "", "Yer", "", "", "", "Toplam", "", "", "", "Ortalama", "", "", "", ""];
            const header3 = ["Sıra No", "Adı", "Soyadı",
                "E (%)", "Not", "D (%)", "Not",
                "E (%)", "Not", "D (%)", "Not",
                "E (%)", "Not", "D (%)", "Not",
                "E (%)", "Not", "D (%)", "Not",
                "E (%)", "Not", "D (%)", "Not",
                "Puan", "Değ.", "Durum", "Mevcut Bröve", "Yeni Bröve"];
            ws_data.push(header2);
            ws_data.push(header3);

            // Data
            summaryData.forEach((d, idx) => {
                const rIdx = idx + 4; // Data row index
                // FORMULA COLS SHIFTED +1 due to "Sıra No"
                // Old references shifted: C->D ... S->T, U->V, W->X
                const getFormulaE = (colChar) => {
                    return { f: `IF(${colChar}${rIdx}="","",IF(${colChar}${rIdx}>=92,"Mükemmel",IF(${colChar}${rIdx}>=87,"Çok İyi",IF(${colChar}${rIdx}>=80,"İyi",IF(${colChar}${rIdx}>=75,"Geçer","Yetersiz")))))` };
                };
                const getFormulaD = (colChar) => {
                    return { f: `IF(${colChar}${rIdx}="","",IF(${colChar}${rIdx}>=94,"Mükemmel",IF(${colChar}${rIdx}>=88,"Çok İyi",IF(${colChar}${rIdx}>=80,"İyi",IF(${colChar}${rIdx}>=65,"Geçer","Yetersiz")))))` };
                };

                // Mapping Columns
                // Old Y -> New Z (Status)
                // Old Z -> New AA (Current)
                // Old AA -> New AB (New)

                const statusCol = `Z${rIdx}`;
                const currentBadgeCol = `AA${rIdx}`;
                const colTotE = `T${rIdx}`;
                const colTotD = `V${rIdx}`;
                const colOverall = `X${rIdx}`;

                // Lookup Current Badge
                let badge = "";
                if (window.REFEREE_BADGES) {
                    const cleanObj = (str) => str.replace(/[^A-ZÇĞİÖŞÜa-zçğıöşü]/g, '').toLocaleUpperCase('tr-TR');
                    const targetName = cleanObj(d.firstName + d.lastName);
                    const targetNameRev = cleanObj(d.lastName + d.firstName);
                    const badgeKeys = Object.keys(window.REFEREE_BADGES);

                    for (const key of badgeKeys) {
                        const keyClean = cleanObj(key);
                        if (keyClean === targetName || keyClean === targetNameRev) { badge = window.REFEREE_BADGES[key]; break; }
                        if ((keyClean.includes(targetName) || targetName.includes(keyClean)) && Math.min(keyClean.length, targetName.length) > 6) { badge = window.REFEREE_BADGES[key]; break; }
                    }
                }

                // CONDITIONAL LOGIC FOR ZORUNLU
                const isSerbest = (activeMatrixTab === 'serbest');
                const valD = (val) => val; // Show D-scores for both Serbest and Zorunlu

                // Status Formula
                const condition = isSerbest ? `AND(${colTotE}>=75,${colTotD}>=65)` : `${colTotE}>=75`;

                // NEW BADGE FORMULA LOGIC
                let newBadgeExpr = "";

                // EXCEPTIONS: Force "Bölge" for Cansu Cansöz, Sudenur Demir, Nurgül Demir/Doğan
                const exCansu = `AND(B${rIdx}="CANSU",C${rIdx}="CANSÖZ")`;
                const exSudenur = `AND(B${rIdx}="SUDENUR",C${rIdx}="DEMİR")`;
                const exNurgul = `AND(B${rIdx}="NURGÜL",OR(C${rIdx}="DEMİR",C${rIdx}="DOĞAN"))`;
                const exceptionCheck = `OR(${exCansu},${exSudenur},${exNurgul})`;

                if (isSerbest) {
                    // Serbest Logic
                    const milliCrit = `AND(${colTotD}>=65,${colTotE}>=75,${colOverall}>=70)`;
                    const bolgeCrit = `AND(${colTotD}>=50,${colTotE}>=70,${colOverall}>=60)`;

                    const standardLogic = `IF(${currentBadgeCol}="Milli","Milli",IF(${milliCrit},"Milli",IF(AND(${currentBadgeCol}="Aday",${bolgeCrit}),"Bölge",${currentBadgeCol})))`;

                    // Apply Exceptions
                    newBadgeExpr = `IF(${exceptionCheck},"Bölge",${standardLogic})`;

                } else {
                    // Zorunlu Logic
                    newBadgeExpr = `IF(${statusCol}="BAŞARISIZ",${currentBadgeCol},IF(OR(${currentBadgeCol}="Aday",${currentBadgeCol}="Bölge"),"Milli",${currentBadgeCol}))`;
                }

                const row = [
                    (idx + 1), // Sıra No
                    d.firstName, d.lastName,
                    d.atm_e, getFormulaE('D'), valD(d.atm_d), getFormulaD('F'),
                    d.kp_e, getFormulaE('H'), valD(d.kp_d), getFormulaD('J'),
                    d.d_e, getFormulaE('L'), valD(d.d_d), getFormulaD('N'),
                    d.y_e, getFormulaE('P'), valD(d.y_d), getFormulaD('R'),
                    d.tot_e, getFormulaE('T'), valD(d.tot_d), getFormulaD('V'),
                    d.overall, getFormulaD('X'),
                    { f: `IF(${condition},"BAŞARILI","BAŞARISIZ")` },
                    badge,
                    { f: newBadgeExpr }
                ];
                ws_data.push(row);
            });

            // Create Sheet 1
            const ws = XLSX.utils.aoa_to_sheet(ws_data, { origin: "A2" });
            const dateStr = new Date().toISOString().slice(0, 10);
            const title = `Sınav Sonuçları - ${activeMatrixTab.toUpperCase()} - ${dateStr}`;
            XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: "A1" });

            // Merges
            if (!ws['!merges']) ws['!merges'] = [];
            ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 27 } }); // Title (A-AB)
            ws['!merges'].push({ s: { r: 1, c: 3 }, e: { r: 1, c: 6 } }); // AtM (D-G, 4 cols) -> indices 3-6
            ws['!merges'].push({ s: { r: 1, c: 7 }, e: { r: 1, c: 10 } }); // KP (H-K, 4 cols)
            ws['!merges'].push({ s: { r: 1, c: 11 }, e: { r: 1, c: 14 } }); // D (L-O, 4 cols)
            ws['!merges'].push({ s: { r: 1, c: 15 }, e: { r: 1, c: 18 } }); // Y (P-S, 4 cols)
            ws['!merges'].push({ s: { r: 1, c: 19 }, e: { r: 1, c: 22 } }); // Toplam (T-W, 4 cols)
            ws['!merges'].push({ s: { r: 1, c: 23 }, e: { r: 1, c: 24 } }); // Ortalama (X-Y, 2 cols)
            ws['!merges'].push({ s: { r: 1, c: 25 }, e: { r: 1, c: 25 } }); // Durum 
            ws['!merges'].push({ s: { r: 1, c: 26 }, e: { r: 1, c: 26 } }); // Mevcut 
            ws['!merges'].push({ s: { r: 1, c: 27 }, e: { r: 1, c: 27 } }); // Yeni

            // Widths
            ws['!cols'] = [
                { wch: 5 }, // No
                { wch: 20 }, { wch: 20 }, // Name, Surname
                { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
                { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
                { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
                { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
                { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
                { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }
            ];

            // Workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Özet Rapor");

            // CONDITIONAL EXPORT LOGIC
            // Generate Detailed D Sheet for both Serbest and Zorunlu
            if (activeMatrixTab === 'serbest' || activeMatrixTab === 'zorunlu') {
                // --- SERBEST/ZORUNLU: Hareket Analizi Sheet ---

                // Sheet 2: Hareket Analizi (D) - Strict Format with Ratings
                const moveData = [];
                // Helper for Rating
                const getRatingLabel = (score) => {
                    const s = parseFloat(score);
                    if (isNaN(s)) return "";
                    if (s >= 94) return "Mükemmel";
                    if (s >= 90) return "Çok İyi";
                    if (s >= 80) return "İyi";
                    if (s >= 65) return "Geçer";
                    return "Yetersiz";
                };

                // Apparatus Code Map
                const appCodeMap = { 'Kız Paraleli': 'KP', 'Denge': 'D', 'Yer': 'Y', 'Atlama Masası': 'AtM' };

                finalReferees.forEach(r => {
                    const refResults = matrixData.results[r.key] || {};
                    // Group videos by apparatus to find index
                    const videosByApp = {};
                    visibleVideos.forEach(v => {
                        if (!videosByApp[v.apparatus]) videosByApp[v.apparatus] = [];
                        videosByApp[v.apparatus].push(v);
                    });

                    visibleVideos.forEach(v => {
                        const res = refResults[v.id];
                        if (res) {
                            // Strict D Filter: Type D or has D-score/zorunluDeduction and is NOT Type E
                            let isD = (res.type === 'D') ||
                                ((res.d !== undefined && res.d !== "") || (res.zorunluDeduction !== undefined && res.zorunluDeduction > 0)) && res.type !== 'E';

                            if (res.e !== undefined && res.e !== "" && (res.d === undefined || res.d === "") && (!res.zorunluDeduction)) isD = false;

                            if (isD) {
                                const bd = res.breakdown || res.totalMoves || {}; // User breakdown
                                const isVault = (v.apparatus === 'AtM' || v.apparatus === 'Atlama Masası');

                                // Find Expert Key (Index 1..5)
                                const appCode = appCodeMap[v.apparatus] || v.apparatus; // Map full name to KP/D/Y/AtM
                                const vIndex = videosByApp[v.apparatus].findIndex(vid => vid.id === v.id) + 1;

                                // Fetch Expert Data
                                let expertData = { moves: {}, kg: 0, bd: 0, totalD: 0 };
                                if (window.EXPERT_SERBEST_DATA && window.EXPERT_SERBEST_DATA[appCode] && window.EXPERT_SERBEST_DATA[appCode][vIndex]) {
                                    const ex = window.EXPERT_SERBEST_DATA[appCode][vIndex];
                                    if (ex.d) {
                                        // Simple Total D (AtM or simplified)
                                        expertData.totalD = ex.d;
                                    } else {
                                        // Detailed
                                        expertData.moves = ex.moves || {};
                                        expertData.kg = ex.kg || 0;
                                        expertData.bd = ex.bd || 0;
                                        // Calculate Total D
                                        let calcD = 0;
                                        const weights = { 'A': 0.1, 'B': 0.2, 'C': 0.3, 'D': 0.4, 'E': 0.5, 'F': 0.6, 'G': 0.7, 'H': 0.8, 'I': 0.9, 'J': 1.0 };
                                        Object.entries(expertData.moves).forEach(([key, count]) => {
                                            calcD += (count * (weights[key] || 0));
                                        });
                                        calcD += expertData.kg;
                                        calcD += expertData.bd;
                                        expertData.totalD = parseFloat(calcD.toFixed(2));
                                    }
                                } else if (v.isZorunlu && v.expertDMoves) {
                                    // ZORUNLU Expert D Logic
                                    let zorunluTotal = 0;
                                    Object.values(v.expertDMoves).forEach(val => {
                                        if (Array.isArray(val)) zorunluTotal += Math.max(...val.filter(n => !isNaN(n)));
                                        else if (!isNaN(parseFloat(val))) zorunluTotal += parseFloat(val);
                                    });
                                    expertData.totalD = zorunluTotal;
                                } else {
                                    expertData.totalD = parseFloat(v.expertD || 0);
                                }

                                // User Inputs
                                const userKG = parseFloat(res.cr || 0); // CR mapped to KG
                                const userBD = parseFloat(res.cv || 0) + parseFloat(res.btrs || 0); // CV + BTRS mapped to BD+Bns
                                const userTotalD = parseFloat(res.zorunluDeduction || res.d || 0);

                                // Calculations
                                const expertTotalD = parseFloat(expertData.totalD || 0);
                                const diff = Math.abs(userTotalD - expertTotalD);

                                // NEW FORMULA: Component-Based Deviation (Based on User Screenshot)
                                // Standard: 1.00 (100%) - Penalties
                                // Penalties:
                                // - Moves (A-J): 0.1 per count mismatch
                                // - KG (CR): 0.1 per unit deviation (Derived from formula structure)
                                // - BD (BTRS/Bonus): 1.0 per unit deviation (Derived from formula ending with *1)

                                let totalPenalty = 0;

                                if (isVault) {
                                    if (Math.abs(userTotalD - expertTotalD) < 0.001) {
                                        totalPenalty = 0;
                                    } else {
                                        totalPenalty = 1.0;
                                    }
                                } else {
                                    // 1. Move Count Penalties
                                    const keys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
                                    keys.forEach(key => {
                                        const uCount = bd[key] || 0;
                                        const eCount = expertData.moves[key] || 0;
                                        totalPenalty += Math.abs(uCount - eCount) * 0.1;
                                    });

                                    // 2. KG Penalty
                                    const expertKG = expertData.kg || 0;
                                    totalPenalty += Math.abs(userKG - expertKG) * 0.1;

                                    // 3. BD Penalty 
                                    const expertBD = expertData.bd || 0;
                                    totalPenalty += Math.abs(userBD - expertBD) * 1.0;
                                }

                                // Final Score
                                // If penalties > 1, score goes negative (as seen in user screenshot -90%)
                                // We calculate percentage: (1 - penalty) * 100
                                const successScore = 1.0 - totalPenalty;
                                let successPct = successScore * 100;
                                if (successPct < 0) successPct = 0;

                                const rating = getRatingLabel(successPct);

                                const row = {
                                    "Hakem": r.name,
                                    "Video": v.title,
                                    "Alet": v.apparatus
                                };

                                // A-J Columns
                                const moveKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
                                moveKeys.forEach(k => {
                                    row[k] = isVault ? "" : (bd[k] || 0);
                                });

                                // KG and BD+Bns
                                row["KG"] = isVault ? "" : userKG;
                                row["BD+Bns"] = isVault ? "" : userBD;

                                // D Scores and Analysis
                                row["D Puanı"] = userTotalD;
                                row["Uzman D"] = expertTotalD;
                                row["Fark"] = parseFloat(diff.toFixed(2));
                                row["Başarı (%)"] = parseFloat(successPct.toFixed(2));
                                row["Değerlendirme"] = rating;

                                moveData.push(row);
                            }
                        }
                    });
                });

                const ws_moves = XLSX.utils.json_to_sheet(moveData);
                XLSX.utils.book_append_sheet(wb, ws_moves, "Uzman D");
            } // End of Serbest-only block for D Analysis


            // --- NEW SHEET: Hareket Analizi (E) ---
            // Similar to Zorunlu logic: List E scores and calculate success via Matrix
            const eData = [];
            visibleReferees.forEach(r => {
                const refResults = matrixData.results[r.key] || {};
                visibleVideos.forEach(v => {
                    const res = refResults[v.id];
                    if (res) {
                        // Check if this is an E-score (or contains E)
                        // Logic: if type is E, or type is undefined but 'e' value exists
                        // Note: Some judges might be D judges but we only want E judges here?
                        // The user said "Hareket Analizi (E)" is for E-scores.

                        let hasE = false;
                        if (res.type === 'E') hasE = true;
                        else if (res.e !== undefined && res.e !== null && res.e !== "") hasE = true;

                        if (hasE) {
                            // Calculate Success using Matrix (Zorunlu Logic)
                            const expertE = v.expertE || 0;
                            const judgeE = parseFloat(res.e);
                            const dev = Math.abs(judgeE - expertE);

                            const rowK = expertE.toFixed(1);
                            const devK = dev.toFixed(1);
                            const matrixScore = getMatrixValue(rowK, devK);
                            let acc = matrixScore * 100;
                            if (acc < 0) acc = 0;

                            eData.push({
                                "Hakem": r.name,
                                "Video": v.title,
                                "Alet": v.apparatus,
                                "E Puanı": judgeE,
                                "Uzman E": expertE,
                                "Sapma": parseFloat(dev.toFixed(2)),
                                "Başarı (%)": parseFloat(acc.toFixed(2))
                            });
                        }
                    }
                });
            });

            if (eData.length > 0) {
                const ws_e = XLSX.utils.json_to_sheet(eData);
                XLSX.utils.book_append_sheet(wb, ws_e, "Hareket Analizi (E)");
            }




            // Sheet 4: Uzman E
            const expertEData = visibleVideos.map(v => ({
                "Video": v.title,
                "Alet": v.apparatus,
                "Uzman E": v.expertE || 10
            }));
            const wsExpE = XLSX.utils.json_to_sheet(expertEData);
            XLSX.utils.book_append_sheet(wb, wsExpE, "Uzman E");








            // --- 5. INDIVIDUAL REPORTS SHEET (Bireysel Hakem Raporları) ---
            if (activeMatrixTab === 'serbest') {
                const ws_ind_data = [];

                const ws_ind_merges = [];
                let rOffset = 0; // Tracks the current row index in the new sheet

                // STYLES
                const styleCenter = { alignment: { horizontal: "center", vertical: "center" }, font: { name: "Arial", sz: 10 } };
                const styleBold = { alignment: { horizontal: "center", vertical: "center" }, font: { name: "Arial", sz: 11, bold: true } };
                const styleHeaderMain = {
                    alignment: { horizontal: "center", vertical: "center" },
                    font: { name: "Arial", sz: 12, bold: true },
                    fill: { fgColor: { rgb: "FFFFFF" } } // White bg for titles? Or leave blank
                };

                // Yellow Header (Table Headers)
                const styleYellow = {
                    alignment: { horizontal: "center", vertical: "center", wrapText: true },
                    font: { name: "Arial", sz: 10, bold: true },
                    fill: { fgColor: { rgb: "FFFF00" } }, // Yellow
                    border: {
                        top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }
                    }
                };

                // Value Cells (Borders)
                const styleBorder = {
                    alignment: { horizontal: "center", vertical: "center" },
                    font: { name: "Arial", sz: 10 },
                    border: {
                        top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }
                    }
                };

                // Rating Cells (Green/Red text based on value) - will apply dynamically?
                // Or just generic border for now, logic inside loop for specific color? 
                // Let's use generic border style for all data cells first.

                // Helper to add merge
                const addMerge = (sR, sC, eR, eC) => {
                    ws_ind_merges.push({ s: { r: sR, c: sC }, e: { r: eR, c: eC } });
                };

                // Helper to create Cell Object with Style
                const c = (val, style) => ({ v: val, s: style });
                const f = (form, style) => ({ f: form, s: style }); // Formula cell

                summaryData.forEach((d, idx) => {
                    // Determine Summary Row Index (1-based for Excel)
                    // Summary Sheet Starts at Row 4 (Data starts). Row 4 is Index 3? 
                    // Wait. `ws_data` pushed 2 headers. `origin: A2`.
                    // A1: Title. A2: Empty/Header2? No, `origin: A2` means ws_data starts at A2.
                    // ws_data[0] = header2 (Row 2).
                    // ws_data[1] = header3 (Row 3).
                    // ws_data[2] = First Data (Row 4).
                    // So for idx=0, Row is 4.
                    const sumRow = idx + 4;

                    // ROW 1: HEADER TITLE 1
                    const r1 = rOffset;
                    ws_ind_data.push([c("TÜRKİYE CİMNASTİK FEDERASYONU ARTİSTİK CİMNASTİK KADINLAR", styleHeaderMain)]);
                    addMerge(r1, 0, r1, 12);

                    // ROW 2: HEADER TITLE 2
                    ws_ind_data.push([c("2025 YILI HAKEM VİZE VE TERFİ SINAVI SONUÇLARI", styleHeaderMain)]);
                    addMerge(r1 + 1, 0, r1 + 1, 12);

                    // ROW 3: EMPTY
                    ws_ind_data.push([]);

                    // ROW 4: Sayın: [Name]
                    const r4 = rOffset + 3;
                    ws_ind_data.push(["Sayın:", c(`${d.firstName} ${d.lastName}`, { font: { bold: true, sz: 11 } })]);
                    addMerge(r4, 1, r4, 6);

                    // ROW 5: Info Text
                    ws_ind_data.push(["Sınav sonuçlarınız \"FIG\" sınav değerlendirme puanlamasına göre aşağıda belirtilmiştir."]);
                    addMerge(r4 + 1, 0, r4 + 1, 12);

                    // ROW 6: Badge (Ulusal düzeyde bröveniz)
                    // We use FORMULA to pull from Summary Sheet Column 25 (Z) ? No, Column 26 (AA) for New?
                    // User wants "Mevcut Bröve" or "Yeni Bröve"? 
                    // Screenshot says "Ulusal düzeyde bröveniz: Bölge".
                    // Let's use Values from object `d` to keep it simple or formula?
                    // Using formula ensures if they edit Summary manually, this updates.
                    // Summary Cols:
                    // ... X(23) rating, Y(24) Status, Z(25) Current, AA(26) New.
                    // Col Z is 25 -> 'Z'. Col AA is 26 -> 'AA'.
                    const colBadge = 'Z'; // Current badge usually? Or New? New is usually the result.
                    // Let's use Z (Mevcut) as per screenshot "Bölge" implies current. 
                    // But report is "Results", so maybe New? Let's use NEW (AA).
                    // Wait, if New is empty? New Formula logic handles it.

                    const r6 = rOffset + 5;
                    ws_ind_data[r6] = []; // Initialize logic for sparse array if pushing failed? No push works.
                    // We need to push the row.
                    // Re-calculating Badge Logic locally just for the LABEL? 
                    // Or referencing Summary? `='Özet Rapor'!AA${sumRow}`

                    ws_ind_data.push([
                        "Ulusal düzeyde bröveniz:",
                        f(`'Özet Rapor'!AA${sumRow}`, { font: { bold: true }, fill: { fgColor: { rgb: "E0E0E0" } } })
                    ]);
                    addMerge(r6, 1, r6, 3);

                    // ROW 7: App Icons / Headers - YELLOW HEADER
                    // A-B: Empty/Name. C-D: Atlama, etc.
                    const row7 = [
                        c("", styleYellow), c("", styleYellow), // A-B
                        c("Atlama", styleYellow), c("", styleYellow),
                        c("Asimetrik Paralel", styleYellow), c("", styleYellow),
                        c("Denge", styleYellow), c("", styleYellow),
                        c("Yer", styleYellow), c("", styleYellow),
                        c("Toplam", styleYellow), c("", styleYellow), c("", styleYellow)
                    ];
                    ws_ind_data.push(row7);
                    addMerge(rOffset + 6, 2, rOffset + 6, 3); // Atlama
                    addMerge(rOffset + 6, 4, rOffset + 6, 5); // Paralel
                    addMerge(rOffset + 6, 6, rOffset + 6, 7); // Denge
                    addMerge(rOffset + 6, 8, rOffset + 6, 9); // Yer
                    addMerge(rOffset + 6, 10, rOffset + 6, 12); // Toplam

                    // ROW 8: Sub-Headers (E | D | ...) - YELLOW HEADER
                    const row8 = [
                        c("Adı", styleYellow), c("Soyadı", styleYellow),
                        c("E", styleYellow), c("D", styleYellow),
                        c("E", styleYellow), c("D", styleYellow),
                        c("E", styleYellow), c("D", styleYellow),
                        c("E", styleYellow), c("D", styleYellow),
                        c("E", styleYellow), c("D", styleYellow),
                        c("Ortalama", styleYellow)
                    ];
                    ws_ind_data.push(row8);

                    // ROW 9: DATA VALUES (Formulas from Summary)
                    // Summary Cols (0-based in array, A=0):
                    // C(2)=AtM E, E(4)=AtM D
                    // G(6)=KP E, I(8)=KP D
                    // K(10)=D E, M(12)=D D
                    // O(14)=Y E, Q(16)=Y D
                    // S(18)=Tot E, U(20)=Tot D
                    // W(22)=Overall

                    // Note: Summary E cols are raw values (e.g. 9.1). Report wants %.
                    // Formula: `='Özet Rapor'!C4 * 10` (if 9.1 -> 91).
                    // Formatting: 0"%"

                    // Note: Summary D cols are Raw D-Scores (e.g. 3.4) OR %? 
                    // In Summary Report `d.atm_d` was raw avg. 
                    // If user wants % here... previously we assumed `atm_d` WAS %.
                    // If D is raw, we can't derive % without knowing Max D.
                    // Assuming Summary D columns ARE percentages as per user request (D%).
                    // So we just link them.

                    const link = (col) => ({ f: `'Özet Rapor'!${col}${sumRow}`, s: styleBorder });
                    const linkPct = (col) => ({ f: `'Özet Rapor'!${col}${sumRow}`, s: { ...styleBorder, numFmt: "0.00" } }); // Just raw value?
                    // If Summary has "88" (number), we show "88". If it has "88%", we show "88%".
                    // Summary columns "E(%)" are populated with `d.atm_e`.
                    // If `d.atm_e` is 9.2, Summary shows 9.2. User wants 92% here.
                    // So formula: `='Özet Rapor'!C4 * 10`.
                    // Wait, if Summary D is already %, just link.

                    // Let's assume we multiply E by 10.
                    const fE = (col) => ({ f: `'Özet Rapor'!${col}${sumRow}*10`, s: { ...styleBorder, numFmt: "0\"%\"" } });
                    // For D, assume direct link, format as % symbol if it's 0-100 number.
                    const fD = (col) => ({ f: `'Özet Rapor'!${col}${sumRow}`, s: { ...styleBorder, numFmt: "0\"%\"" } });

                    const row9 = [
                        f(`'Özet Rapor'!A${sumRow}`, styleBorder), // Ad (A)
                        f(`'Özet Rapor'!B${sumRow}`, styleBorder), // Soyad (B)

                        fE('C'), fD('E'), // Atlama
                        fE('G'), fD('I'), // KP
                        fE('K'), fD('M'), // Denge
                        fE('O'), fD('Q'), // Yer
                        fE('S'), fD('U'), // Toplam (Cols S, U)

                        f(`'Özet Rapor'!W${sumRow}`, { ...styleBorder, font: { bold: true }, numFmt: "0.00" }) // Avg (W)
                    ];
                    ws_ind_data.push(row9);

                    // ROW 10: RATINGS (Formulas?)
                    // Since we have Formulas in Summary for Ratings (e.g. Col D, F, H, J...)
                    // We can just link them!
                    // Summary Cols for Ratings:
                    // D(3), F(5), H(7), J(9), L(11), N(13), P(15), R(17)...
                    // Not columns are interspersed.
                    // Header3 in Summary: E%, Not(D?), D%, Not(F?)...
                    // Let's check Header3 indices:
                    // C(2)=E%, D(3)=Not
                    // E(4)=D%, F(5)=Not
                    // G(6)=E%, H(7)=Not
                    // I(8)=D%, J(9)=Not
                    // ...
                    // So we check D, F, H, J, L, N, P, R, T, V, X(Avg Rating).

                    const linkR = (col) => ({
                        f: `'Özet Rapor'!${col}${sumRow}`,
                        s: {
                            ...styleBorder,
                            fill: { fgColor: { rgb: "E2EFDA" } }, // Light Green bg
                            font: { color: { rgb: "006100" } } // Dark Green text
                        }
                    });

                    const row10 = [
                        c("", styleBorder), c("", styleBorder),
                        linkR('D'), linkR('F'), // AtM Ratings
                        linkR('H'), linkR('J'), // KP Ratings
                        linkR('L'), linkR('N'), // D Ratings
                        linkR('P'), linkR('R'), // Yer Ratings
                        linkR('T'), linkR('V'), // Total Ratings
                        linkR('X') // Avg Rating
                    ];
                    ws_ind_data.push(row10);

                    // ROW 11: FOOTER
                    const r11 = rOffset + 10;
                    ws_ind_data.push([c("Cimnastik Sporuna verdiğiniz katkıdan dolayı teşekkür ederiz.", styleCenter)]);
                    addMerge(r11, 0, r11, 12);

                    // Spacers
                    ws_ind_data.push([]);
                    ws_ind_data.push([]);
                    ws_ind_data.push([]);

                    // Update Offset
                    rOffset += 14;
                });

                const ws_ind = XLSX.utils.aoa_to_sheet(ws_ind_data);

                // Apply Merges
                ws_ind['!merges'] = ws_ind_merges;

                // Set Column Widths
                ws_ind['!cols'] = [
                    { wch: 15 }, { wch: 15 },
                    { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
                    { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
                    { wch: 8 }, { wch: 10 }, { wch: 12 }
                ];

                XLSX.utils.book_append_sheet(wb, ws_ind, "Bireysel Hakem Raporları");
            } // End of activeMatrixTab === 'serbest' check for Individual Reports

            // --- END INDIVIDUAL REPORTS ---

            /* Write File */
            XLSX.writeFile(wb, "Sinav_Sonuclari_" + activeMatrixTab + "_" + dateStr + ".xlsx");


        } catch (err) {
            console.error("Export error:", err);
            if (window.showToast) window.showToast("Excel oluşturulurken hata oluştu.", "error");
            else alert("Excel oluşturulurken hata oluştu: " + err);
        } finally {
            if (loading) loading.style.display = 'none';
        }
    }, 100);
};
