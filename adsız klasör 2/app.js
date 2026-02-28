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
    console.log("=== VERSION 2.33 ===");
    // alert("VERSION 2.33 WORKING"); 
    console.log("Check JS Version: 2.33");
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

    // Load Global Settings
    db.ref('settings/scoring').on('value', snap => {
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
        db.ref('referees').orderByChild('token').equalTo(token).once('value', snapshot => {
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
                const snapshot = await db.ref('referees').orderByChild('email').equalTo(email).once('value');
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
                document.getElementById(btn.dataset.target).style.display = 'block';

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

                const ref = await db.ref('exams').push(examData);
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
            db.ref('exams').on('value', snapshot => {
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
                localStorage.setItem('activeExamId', activeExamId);
                const infoDiv = document.getElementById('active-exam-info');
                const detailsDiv = document.getElementById('exam-details');

                if (!activeExamId) {
                    if (infoDiv) infoDiv.style.display = 'none';
                    localStorage.removeItem('activeExamId');
                    return;
                }

                // Fetch exam details
                const examSnap = await db.ref('exams/' + activeExamId).once('value');
                const exam = examSnap.val();

                // Count results for this exam
                const resultsSnap = await db.ref('results').orderByChild('examId').equalTo(activeExamId).once('value');
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
                    await db.ref('exams/' + activeExamId).update({ status: 'archived' });
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
                    const snap = await db.ref('results').orderByChild('examId').equalTo(activeExamId).once('value');
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
            await db.ref('exams/' + examId).update({ status: 'active' });
            showToast('Sınav geri alındı.', 'success');
        };

        window.deleteExam = async (examId) => {
            if (await showConfirm('Bu sınavı kalıcı olarak silmek istediğinize emin misiniz?')) {
                await db.ref('exams/' + examId).remove();
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
                    db.ref('referees').push(refData);

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
                    db.ref('videos').push(videoData);
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
        db.ref('videos').on('value', snapshot => {
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
                db.ref('podiums').push({
                    name: `Podyum ${count}`,
                    state: { status: 'IDLE', mode: 'video' },
                    examId: '',
                    createdAt: Date.now()
                });
            });
        }

        // Listen to Podiums
        db.ref('podiums').on('value', snap => {
            allPodiums = snap.val() || {};
            // If window.renderPodiums is not defined yet, this might run too early,
            // but it will be called again when defined or when data changes.
            if (typeof renderPodiums === 'function') {
                renderPodiums();
            }
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
            document.getElementById('edit-v-expert-e').value = video.expertE || 0;

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
                const expertD = parseFloat(document.getElementById('edit-v-expert-d').value) || 0;
                const expertE = parseFloat(document.getElementById('edit-v-expert-e').value) || 0;

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
                    expertE: expertE,
                    isZorunlu: isZorunlu,
                    expertDMoves: isZorunlu ? expertDMoves : null
                };

                db.ref('videos/' + videoId).update(updateData)
                    .then(() => {
                        showToast('Seri güncellendi!', 'success');
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
                db.ref('referees').push(refData);

                // Clear
                ['ref-name', 'ref-surname', 'ref-email', 'ref-tckn', 'ref-phone'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                document.getElementById('ref-podium').value = '';
                showToast('Hakem başarıyla eklendi', 'success');
            });
        }

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
                                db.ref('referees').push(refData);
                                successCount++;
                            } else {
                                errorCount++;
                            }
                        });

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

        db.ref('referees').on('value', snapshot => {
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

                db.ref('system_state').set({
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
                db.ref('system_state').update({
                    replayTimestamp: Date.now()
                });
                showToast('Video tekrar başlatıldı!', 'info');
            });
        }

        if (btnStop) {
            btnStop.addEventListener('click', () => {
                db.ref('system_state').set({
                    status: 'IDLE',
                    activeVideoId: null
                });
                if (btnReplay) btnReplay.style.display = 'none';
                if (modeDisplay) modeDisplay.style.display = 'none';
            });
        }

        db.ref('system_state').on('value', snap => {
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
            db.ref('referees').on('value', snapshot => {
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
                const refSnap = await db.ref('referees/' + refId).once('value');
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
                        const pSnap = await db.ref('podiums/' + referee.podiumId).once('value');
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
                const resSnap = await db.ref('results').orderByChild('refereeId').equalTo(refId).once('value');
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
                db.ref('settings/scoring/diffPoints').set(updates);
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
                    db.ref('settings/scoring/matrixOverrides').update(dataMap);

                    showToast('Tablo değişiklikleri başarıyla kaydedildi.', 'success');
                }
            };
        }

        // 4. Stats View - Grouped with History and Validation
        // 4. Stats View - Grouped with History and Validation
        db.ref('results').on('value', snapshot => {
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

                    let historyHtml = '<td colspan="6"><div class="history-list">';
                    resList.forEach((r, idx) => {
                        const isCurrentlyValid = (idx === validIndex);
                        const rPoint = (r.points * 100).toFixed(1) + '%';

                        // Breakdown Details
                        let details = "";
                        if (r.breakdown) {
                            const moves = Object.entries(r.breakdown || {}).filter(([l, c]) => c > 0).map(([l, c]) => `${l}x${c}`).join(', ');
                            details = `<div class="history-detail" style="font-size:0.8rem; color:var(--primary-light); margin:5px 0;">Detay: [${moves || 'Element Yok'}] | CR:${r.cr || 0} | CV:${r.cv || 0}</div>`;
                        }

                        historyHtml += `
                            <div class="history-item ${isCurrentlyValid ? 'active' : ''}">
                                <div class="history-meta">
                                    <span>Tarih: ${new Date(r.timestamp).toLocaleTimeString()}</span>
                                    <strong>D:${r.d.toFixed(1)} / E:${r.e.toFixed(1)}</strong>
                                    <span>Puan: ${rPoint}</span>
                                </div>
                                <div class="history-actions">
                                    ${!isCurrentlyValid ? `<button class="sm-btn valid-btn" onclick="setValidScore('${r.id}', '${r.videoId}', '${r.refereeId}')">Bunu Seç</button>` : '<span>(Geçerli)</span>'}
                                </div>
                            </div>
                        `;
                    });
                    historyHtml += '</div></td>';
                    historyTr.innerHTML = historyHtml;
                    table.appendChild(historyTr);
                }
            }
        });
    }

    // --- JUDGE MODE LOGIC ---
    let judgeData = { d: 0, e: 10, deductions: 0, elements: [], cv: 0, cr: 0, btrs: 0 };
    let currentActiveVideo = null;
    let activePodiumId = null;
    let currentPodiumExamId = null;
    let activeTimerInterval = null; // Global timer interval
    let previousScores = {}; // Store previous scores by seriesId

    function initJudgeMode() {
        document.getElementById('j-display-name').textContent = currentUser.name;

        // Validate that referee still exists in database
        db.ref('referees/' + currentUser.id).once('value', (snapshot) => {
            if (!snapshot.exists()) {
                showToast('Hakem kaydınız silinmiş! Lütfen yönetici ile iletişime geçin.', 'error');
                localStorage.removeItem('currentUser');
                setTimeout(() => location.reload(), 3000);
                return;
            }

            // Check if referee has assigned podium
            if (!currentUser.podiumId) {
                showToast('Podyum ataması yapılmamış! Lütfen yönetici ile iletişime geçin.', 'error');
                setTimeout(() => location.reload(), 3000);
                return;
            }

            // Directly connect to assigned podium
            console.log('[JUDGE] Auto-connecting to podium:', currentUser.podiumId);
            selectPodium(currentUser.podiumId);
        });

        // Logout button event listener
        const logoutBtn = document.getElementById('btn-judge-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                // Clear localStorage session
                localStorage.removeItem('currentUser');
                showToast('Çıkış yapıldı', 'info');
                // Reload page to show login screen
                location.reload();
            });
        }
    }

    function loadJudgePodiums() {
        const list = document.getElementById('judge-podium-list');
        list.innerHTML = '<div class="loader-circle"></div>';

        db.ref('podiums').once('value', snap => {
            list.innerHTML = '';
            const podiums = snap.val();

            if (!podiums) {
                list.innerHTML = '<p style="text-align:center; color:var(--text-dim)">Aktif podyum bulunamadı.</p>';
                return;
            }

            Object.entries(podiums).forEach(([pid, val]) => {
                const div = document.createElement('div');
                div.className = 'podium-item';
                div.innerHTML = `
                    <div>
                        <h3>${val.name}</h3>
                        <p>${val.state?.status === 'PLAYING' ? '<span style="color:var(--success)">● Yayında</span>' : 'Bekliyor'}</p>
                    </div>
                    <button class="primary-btn sm-btn">Giriş Yap →</button>
                `;
                div.onclick = () => selectPodium(pid);
                list.appendChild(div);
            });
        });
    }

    function selectPodium(pid) {
        activePodiumId = pid;

        // Set Header Info Immediately
        document.getElementById('j-display-name').textContent = currentUser.name || 'Misafir Hakem';

        // Presence Logic
        const presenceRef = db.ref('podiums/' + pid + '/online_judges/' + currentUser.id);
        presenceRef.set({ name: currentUser.name, status: 'online' });
        presenceRef.onDisconnect().remove();

        // Listen to Podium State
        db.ref('podiums/' + pid).on('value', async snapshot => {
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

                if (state.mode === 'timer' || !state.activeVideoId) {
                    // Timer mode - show series data and timer
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
                    startExamForJudge(true, judgeData.duration); // true = timer mode, pass duration
                } else {
                    // Video mode (legacy - not used anymore but kept for compatibility)
                    if (state.activeVideoId) {
                        try {
                            const vSnap = await db.ref('videos/' + state.activeVideoId).once('value');
                            if (vSnap.exists()) {
                                currentActiveVideo = { id: state.activeVideoId, ...vSnap.val() };
                                startExamForJudge();
                            } else {
                                console.warn("Video data not found:", state.activeVideoId);
                                document.getElementById('j-display-apparatus').textContent = podium.name;
                                resetJudgeUI();
                                showScreen('judge');
                            }
                        } catch (e) {
                            console.error("Error fetching video:", e);
                            document.getElementById('j-display-apparatus').textContent = podium.name;
                            resetJudgeUI();
                            showScreen('judge');
                        }
                    } else {
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
                // D-Score Scoring Logic: 1.0 - (abs(diff) * 2)
                deviation = Math.abs(judgeD - expD);
                finalPoints = Math.max(0, 1.0 - (deviation * 2));
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
                const snapshot = await db.ref('results')
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

                    await db.ref('results/' + existingKey).update(dataToSave);
                    showToast('Puan güncellendi (Eski puan geçmişe eklendi).', 'success');
                } else {
                    // CREATE NEW
                    await db.ref('results').push(dataToSave);
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
        let dFromMoves = 0;

        for (const [level, count] of Object.entries(judgeData.totalMoves || {})) {
            const pointVal = globalSettings.diffPoints[level] || 0;
            dFromMoves += (count * pointVal);
        }

        judgeData.d = dFromMoves + judgeData.cv + judgeData.cr + (judgeData.btrs || 0);
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
                const snapshot = await db.ref('results')
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

        // Setup D-Panel Mode (Standard vs Zorunlu)
        const standardPanel = document.getElementById('j-panel-d-standard');
        const zorunluPanel = document.getElementById('j-panel-d-zorunlu');
        const isZorunlu = currentActiveVideo.isZorunlu || false;

        console.log('[JUDGE] Setup D-Panel. Video:', currentActiveVideo.title);
        console.log('[JUDGE] isZorunlu:', isZorunlu);
        console.log('[JUDGE] Expert Moves:', currentActiveVideo.expertDMoves);

        if (isZorunlu) {
            console.log('[JUDGE] Switching to Zorunlu Mode UI');
            if (standardPanel) standardPanel.style.display = 'none';
            if (zorunluPanel) zorunluPanel.style.display = 'block';

            // Hide Bonus Section (CR/CV) explicitly
            const bonusSection = document.querySelector('.bonus-section');
            if (bonusSection) bonusSection.style.display = 'none';

            // setup Zorunlu Dynamic Grid
            // setup Zorunlu Dynamic Grid
            let gridWrapper = zorunluPanel.querySelector('.zorunlu-dynamic-grid');
            if (!gridWrapper) {
                // Determine if we accidentally used the parent before and clean it
                if (zorunluPanel.classList.contains('zorunlu-dynamic-grid')) {
                    zorunluPanel.classList.remove('zorunlu-dynamic-grid');
                    zorunluPanel.style.display = 'block'; // Reset display to block
                    zorunluPanel.innerHTML = ''; // Wipe malformed content
                }

                gridWrapper = document.createElement('div');
                gridWrapper.className = 'zorunlu-dynamic-grid';
                gridWrapper.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px; margin-top:10px;';
                zorunluPanel.appendChild(gridWrapper);
            } else {
                gridWrapper.innerHTML = ''; // Clear previous content
            }

            const expertMoves = currentActiveVideo.expertDMoves || {};

            // Generate D1-D11 controls
            for (let i = 1; i <= 11; i++) {
                const key = `d${i}`;
                let refVal = expertMoves[key];

                // ROBUST PARSING: Handle string with commas
                if (typeof refVal === 'string' && refVal.includes(',')) {
                    refVal = refVal.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
                }

                console.log(`[JUDGE] Move ${key}:`, refVal); // Debug Log

                // Determine previous value if exists
                let prevVal = 0;
                if (previousScore && previousScore.totalMoves) {
                    prevVal = previousScore.totalMoves[key] || 0;
                }

                if (Array.isArray(refVal)) {
                    // MULTI VALUE: Radio Group
                    const wrapper = document.createElement('div');
                    wrapper.style.cssText = 'background:var(--surface-light); border:1px solid var(--glass-border); border-radius:8px; padding:5px; display:flex; flex-direction:column; gap:5px; width:100%';

                    wrapper.innerHTML = `<div style="text-align:center; font-weight:bold; font-size:0.8rem; color:var(--text-dim)">D${i}</div>`;

                    const btnGroup = document.createElement('div');
                    btnGroup.style.display = 'flex';
                    btnGroup.style.gap = '5px';

                    refVal.forEach(val => {
                        const btn = document.createElement('button');
                        btn.className = `z-multi-btn z-multi-btn-${key}`; // Unique class for grouping
                        btn.style.cssText = 'flex:1; padding:8px 2px; border:1px solid var(--glass-border); border-radius:4px; font-weight:700; font-size:0.9rem; cursor:pointer;';

                        btn.textContent = val.toFixed(1);
                        btn.dataset.key = key;
                        btn.dataset.value = val;

                        if (prevVal === val) {
                            btn.style.background = 'var(--primary)';
                            btn.style.color = 'white';
                            btn.classList.add('active');
                        } else {
                            btn.style.background = 'transparent';
                            btn.style.color = 'var(--text-dim)';
                        }

                        btn.onclick = () => {
                            // Toggle logic: If clicking active, unselect. If clicking inactive, select it and unselect others.
                            const isActive = btn.classList.contains('active');

                            // Reset all in group
                            document.querySelectorAll(`.z-multi-btn-${key}`).forEach(b => {
                                b.classList.remove('active');
                                b.style.background = 'transparent';
                                b.style.color = 'var(--text-dim)';
                            });

                            if (!isActive) {
                                btn.classList.add('active');
                                btn.style.background = 'var(--primary)';
                                btn.style.color = 'white';
                            }
                            window.calculateZorunluTotal();
                        };
                        btnGroup.appendChild(btn);
                    });
                    wrapper.appendChild(btnGroup);
                    gridWrapper.appendChild(wrapper);

                } else if (parseFloat(refVal) > 0) {
                    // SINGLE VALUE: Toggle Button
                    const val = parseFloat(refVal);
                    const btn = document.createElement('button');
                    btn.className = 'z-toggle-btn';
                    btn.style.cssText = 'width:100%; padding:10px 5px; background:var(--surface-light); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-dim); font-weight:700; cursor:pointer; transition:all 0.2s; display:flex; flex-direction:column; align-items:center; gap:2px;';

                    if (prevVal > 0) {
                        btn.style.background = 'var(--primary)';
                        btn.style.color = 'white';
                        btn.classList.add('active');
                    }

                    btn.innerHTML = `<span style="font-size:0.9rem">D${i}</span><span style="font-size:0.8rem;opacity:0.8">${val.toFixed(1)}</span>`;

                    btn.onclick = () => {
                        btn.classList.toggle('active');
                        if (btn.classList.contains('active')) {
                            btn.style.background = 'var(--primary)';
                            btn.style.color = 'white';
                        } else {
                            btn.style.background = 'var(--surface-light)';
                            btn.style.color = 'var(--text-dim)';
                        }
                        window.calculateZorunluTotal();
                    };

                    btn.dataset.key = key;
                    btn.dataset.value = val;
                    gridWrapper.appendChild(btn);

                } else {
                    // Manual Input -> Select (Combo)
                    const wrapper = document.createElement('div');
                    wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center;';

                    const lbl = document.createElement('label');
                    lbl.textContent = `D${i}`;
                    lbl.style.cssText = 'font-weight:bold; color:var(--text-dim); margin-bottom:5px; font-size:0.8rem';

                    const sel = document.createElement('select');
                    sel.className = 'z-d-input';
                    sel.dataset.key = key;
                    sel.style.cssText = 'width:100%; padding:8px; background:var(--surface-light); border:1px solid var(--glass-border); border-radius:8px; color:var(--text-main); font-weight:700; text-align:center; font-size:1rem; appearance:none;';

                    // Generate options 0.0 to 1.5
                    let opts = '<option value="">-</option>';
                    for (let k = 1; k <= 15; k++) {
                        const v = (k / 10).toFixed(1);
                        opts += `<option value="${v}" ${prevVal === parseFloat(v) ? 'selected' : ''}>${v}</option>`;
                    }
                    sel.innerHTML = opts;

                    sel.onchange = window.calculateZorunluTotal;

                    wrapper.appendChild(lbl);
                    wrapper.appendChild(sel);
                    gridWrapper.appendChild(wrapper);
                }
            }
            window.calculateZorunluTotal();
        } else {
            // Show Bonus Section for Standard Mode
            const bonusSection = document.querySelector('.bonus-section');
            if (bonusSection) bonusSection.style.display = 'block';

            if (standardPanel) standardPanel.style.display = 'block';
            if (zorunluPanel) zorunluPanel.style.display = 'none';
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
        document.getElementById('player-target').innerHTML = `
            <div class="waiting-area">
                <div class="pulse-icon">📡</div>
                <h3>Admin Yayını Başlatması Bekleniyor...</h3>
            </div>
        `;
        document.getElementById('btn-submit-score').disabled = true;
    }

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

    window.deleteVideo = async (key) => { if (await showConfirm('Silinsin mi?')) db.ref('videos/' + key).remove(); };
    window.deleteReferee = async (key) => { if (await showConfirm('Hakem silinsin mi?')) db.ref('referees/' + key).remove(); };
    window.copyToClipboard = (text) => { navigator.clipboard.writeText(text); showToast('Metin Kopyalandı!'); };
    window.copyMagicLink = (token) => {
        const link = `${window.location.origin}/index.html?token=${token}`;
        navigator.clipboard.writeText(link);
        showToast('Giriş Linki Kopyalandı!');
    };

    window.editParameters = async (key) => {
        const snap = await db.ref('videos/' + key).once('value');
        const v = snap.val();
        const newD = await showPrompt('Yeni Uzman D Puanı:', v.expertD);
        const newE = await showPrompt('Yeni Uzman E Puanı:', v.expertE);

        if (newD !== null && newE !== null) {
            db.ref('videos/' + key).update({
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
        const snap = await db.ref('results').once('value');
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
        const snap = await db.ref('referees/' + refKey).once('value');
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

    function getMatrixValue(rowKey, devKey) {
        // Check overrides first
        const overrideKey = rowKey.replace('.', '_');
        if (globalSettings.matrixOverrides[overrideKey] && globalSettings.matrixOverrides[overrideKey][devKey] !== undefined) {
            return globalSettings.matrixOverrides[overrideKey][devKey];
        }
        // Fallback to static TABLO_E from data.js
        const row = TABLO_E[rowKey] || TABLO_E["0.0"];
        return row[devKey] !== undefined ? row[devKey] : 0;
    }

    // --- TOAST & MODAL IMPLEMENTATION ---
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
