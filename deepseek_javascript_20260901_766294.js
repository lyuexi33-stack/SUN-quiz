// ============================
// 数据管理
// ============================
let appData = {
    user: null,            // { id, name }
    units: [],            // [ { name, questions: [ { id, type, stem, options, answer } ] } ]
    currentUnitIndex: -1,
    currentQuestionIndex: 0,
    answers: {},          // { questionId: selectedValue(s) }
    completedUnits: {},   // { unitIndex: true }
    isSubmitted: false,   // 当前单元是否已提交
};

// ============================
// DOM 引用
// ============================
const pageLogin = document.getElementById('page-login');
const pageUnits = document.getElementById('page-units');
const pageQuiz = document.getElementById('page-quiz');

const loginId = document.getElementById('student-id');
const loginName = document.getElementById('student-name');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');

const displayName = document.getElementById('display-name');
const displayId = document.getElementById('display-id');
const btnLogout = document.getElementById('btn-logout');
const unitList = document.getElementById('unit-list');

const fileInput = document.getElementById('file-input');
const btnImport = document.getElementById('btn-import');
const importStatus = document.getElementById('import-status');

const quizTitle = document.getElementById('quiz-title');
const quizProgress = document.getElementById('quiz-progress');
const questionArea = document.getElementById('question-area');
const quizResult = document.getElementById('quiz-result');
const btnBackUnits = document.getElementById('btn-back-units');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnSubmit = document.getElementById('btn-submit');
const btnShowAnswers = document.getElementById('btn-show-answers');

// ============================
// 页面切换
// ============================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

// ============================
// 登录
// ============================
btnLogin.addEventListener('click', () => {
    const id = loginId.value.trim();
    const name = loginName.value.trim();
    if (!id || !name) {
        loginError.textContent = '学号和姓名不能为空';
        return;
    }
    // 尝试从 localStorage 读取已有数据
    const stored = localStorage.getItem('quizData');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            appData.units = parsed.units || [];
            appData.completedUnits = parsed.completedUnits || {};
            // 如果已经有题库，直接显示单元列表
        } catch(e) {}
    }

    appData.user = { id, name };
    displayName.textContent = name;
    displayId.textContent = id;
    loginError.textContent = '';
    showPage('page-units');
    renderUnits();
});

btnLogout.addEventListener('click', () => {
    appData.user = null;
    showPage('page-login');
});

// ============================
// 单元列表渲染
// ============================
function renderUnits() {
    if (appData.units.length === 0) {
        unitList.innerHTML = '<p style="color:#888;">暂无题库，请先导入 .xlsx 文件</p>';
        return;
    }
    let html = '';
    appData.units.forEach((unit, index) => {
        const completed = appData.completedUnits[index] ? 'completed' : '';
        html += `<div class="unit-item ${completed}" data-index="${index}">
            ${unit.name || `第${index+1}单元`}
            ${completed ? ' ✅' : ''}
        </div>`;
    });
    unitList.innerHTML = html;
    // 绑定点击事件
    document.querySelectorAll('.unit-item').forEach(el => {
        el.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            enterUnit(idx);
        });
    });
}

// ============================
// 进入单元
// ============================
function enterUnit(index) {
    if (index < 0 || index >= appData.units.length) return;
    appData.currentUnitIndex = index;
    appData.currentQuestionIndex = 0;
    appData.answers = {};
    appData.isSubmitted = false;
    quizResult.style.display = 'none';
    btnShowAnswers.style.display = 'none';
    showPage('page-quiz');
    renderQuestion();
}

// ============================
// 渲染题目
// ============================
function renderQuestion() {
    const unit = appData.units[appData.currentUnitIndex];
    if (!unit) return;
    const qs = unit.questions;
    if (qs.length === 0) {
        questionArea.innerHTML = '<p>该单元暂无题目</p>';
        return;
    }
    const idx = appData.currentQuestionIndex;
    const q = qs[idx];
    quizTitle.textContent = `${unit.name || `第${appData.currentUnitIndex+1}单元`}`;
    quizProgress.textContent = `${idx+1}/${qs.length}`;

    let html = `<div class="question-text">${idx+1}. ${q.stem}</div>`;
    const inputType = q.type === '单选' ? 'radio' : 'checkbox';
    const nameAttr = `q${q.id}`;

    // 如果已提交，显示答案并禁用输入
    const disabled = appData.isSubmitted ? 'disabled' : '';
    const checkedVal = appData.answers[q.id] || [];

    q.options.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i); // A, B, C, D
        const id = `opt_${q.id}_${i}`;
        const checked = (inputType === 'radio' && checkedVal === opt) ||
                        (inputType === 'checkbox' && checkedVal.includes(opt));
        const checkedAttr = checked ? 'checked' : '';
        html += `
            <div class="option-item">
                <input type="${inputType}" name="${nameAttr}" value="${opt}" id="${id}" ${checkedAttr} ${disabled}>
                <label for="${id}">${letter}. ${opt}</label>
            </div>
        `;
    });

    // 如果已经提交并显示答案，加粗显示正确答案
    if (appData.isSubmitted) {
        const answerText = Array.isArray(q.answer) ? q.answer.join('、') : q.answer;
        html += `<div style="margin-top:12px;color:#2d7d46;font-weight:bold;">✅ 正确答案：${answerText}</div>`;
        if (q.type === '多选') {
            html += `<div style="font-size:13px;color:#666;">（多选题，需全部选对）</div>`;
        }
    }

    questionArea.innerHTML = html;

    // 为当前题目中的选项绑定事件（如果不提交状态）
    if (!appData.isSubmitted) {
        const options = questionArea.querySelectorAll('input');
        options.forEach(input => {
            input.addEventListener('change', function() {
                const qid = q.id;
                if (input.type === 'radio') {
                    appData.answers[qid] = this.value;
                } else if (input.type === 'checkbox') {
                    if (!appData.answers[qid]) appData.answers[qid] = [];
                    const arr = appData.answers[qid];
                    if (this.checked) {
                        if (!arr.includes(this.value)) arr.push(this.value);
                    } else {
                        const idx2 = arr.indexOf(this.value);
                        if (idx2 !== -1) arr.splice(idx2, 1);
                    }
                    if (arr.length === 0) delete appData.answers[qid];
                }
            });
        });
    }

    // 更新导航按钮状态
    btnPrev.disabled = (idx === 0);
    btnNext.disabled = (idx === qs.length - 1);
    btnSubmit.style.display = appData.isSubmitted ? 'none' : 'inline-block';
    btnShowAnswers.style.display = appData.isSubmitted ? 'inline-block' : 'none';
}

// ============================
// 导航按钮
// ============================
btnPrev.addEventListener('click', () => {
    if (appData.currentQuestionIndex > 0) {
        appData.currentQuestionIndex--;
        renderQuestion();
    }
});
btnNext.addEventListener('click', () => {
    const unit = appData.units[appData.currentUnitIndex];
    if (appData.currentQuestionIndex < unit.questions.length - 1) {
        appData.currentQuestionIndex++;
        renderQuestion();
    }
});

btnBackUnits.addEventListener('click', () => {
    showPage('page-units');
    renderUnits();
});

// ============================
// 提交答案
// ============================
btnSubmit.addEventListener('click', function() {
    if (appData.isSubmitted) return;
    const unit = appData.units[appData.currentUnitIndex];
    const qs = unit.questions;
    // 检查是否所有题目都已作答
    let allAnswered = true;
    for (let q of qs) {
        const ans = appData.answers[q.id];
        if (!ans || (Array.isArray(ans) && ans.length === 0)) {
            allAnswered = false;
            break;
        }
    }
    if (!allAnswered) {
        alert('请先完成本单元所有题目再提交。');
        return;
    }

    // 提交后，显示结果（暂时显示所有题目的正确/错误，但我们可以简单显示本次得分）
    // 标记已提交
    appData.isSubmitted = true;
    // 记录本单元完成
    appData.completedUnits[appData.currentUnitIndex] = true;
    // 保存到 localStorage
    localStorage.setItem('quizData', JSON.stringify({
        units: appData.units,
        completedUnits: appData.completedUnits
    }));

    // 显示得分
    let correct = 0;
    qs.forEach(q => {
        const userAns = appData.answers[q.id];
        const correctAns = q.answer;
        // 比较（简单比较，多选需严格相等）
        let isCorrect = false;
        if (q.type === '单选') {
            isCorrect = (userAns === correctAns);
        } else {
            // 多选：比较数组内容是否完全相同
            if (Array.isArray(userAns) && Array.isArray(correctAns)) {
                const sorted1 = [...userAns].sort();
                const sorted2 = [...correctAns].sort();
                isCorrect = JSON.stringify(sorted1) === JSON.stringify(sorted2);
            }
        }
        if (isCorrect) correct++;
    });
    const total = qs.length;
    quizResult.style.display = 'block';
    quizResult.innerHTML = `<strong>提交成功！</strong> 本次答对 ${correct}/${total} 题。`;
    btnShowAnswers.style.display = 'inline-block';
    btnSubmit.style.display = 'none';
    // 重新渲染当前题目（显示正确答案）
    renderQuestion();
});

// ============================
// 查看正确答案（跳转到每题显示，我们已经显示）
// ============================
btnShowAnswers.addEventListener('click', function() {
    // 已经显示了，可以加一个高亮滚动
    alert('每道题下方已显示正确答案，请查看。');
});

// ============================
// 题库导入（xlsx）
// ============================
btnImport.addEventListener('click', function() {
    const file = fileInput.files[0];
    if (!file) {
        importStatus.textContent = '请先选择 .xlsx 文件';
        importStatus.style.color = '#d32f2f';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // 解析：第一行标题，后面每行：题干, 选项A, 选项B, 选项C, 选项D, 答案
            // 假设每单元是一个sheet，但这里简单处理：一个sheet为所有单元，需要按单元分？ 
            // 更合理：每个sheet对应一个单元。我们按照sheet数量创建单元。
            const units = [];
            workbook.SheetNames.forEach((sheetName, idx) => {
                const ws = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                // 跳过空行
                const questions = [];
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length < 6) continue;
                    const stem = row[0]?.toString().trim();
                    if (!stem) continue;
                    const options = [row[1]?.toString().trim(), row[2]?.toString().trim(), row[3]?.toString().trim(), row[4]?.toString().trim()].filter(o => o);
                    if (options.length === 0) continue;
                    const answerRaw = row[5]?.toString().trim();
                    // 判断单选还是多选：如果答案包含多个选项（用、或,分隔）则多选
                    let type = '单选';
                    let answer = answerRaw;
                    if (answerRaw && (answerRaw.includes('、') || answerRaw.includes(','))) {
                        type = '多选';
                        answer = answerRaw.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
                    }
                    questions.push({
                        id: `q${idx}_${i}`,
                        type: type,
                        stem: stem,
                        options: options,
                        answer: answer
                    });
                }
                if (questions.length > 0) {
                    units.push({
                        name: sheetName || `第${idx+1}单元`,
                        questions: questions
                    });
                }
            });

            if (units.length === 0) {
                importStatus.textContent = '未解析到有效题目，请检查格式。';
                importStatus.style.color = '#d32f2f';
                return;
            }

            // 保存到 appData 和 localStorage
            appData.units = units;
            // 保留之前完成记录
            const stored = localStorage.getItem('quizData');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    appData.completedUnits = parsed.completedUnits || {};
                } catch(e) {}
            }
            localStorage.setItem('quizData', JSON.stringify({
                units: appData.units,
                completedUnits: appData.completedUnits
            }));

            importStatus.textContent = `✅ 成功导入 ${units.length} 个单元，共 ${units.reduce((sum, u) => sum + u.questions.length, 0)} 道题。`;
            importStatus.style.color = '#2d7d46';
            renderUnits();
        } catch(err) {
            importStatus.textContent = '解析失败：' + err.message;
            importStatus.style.color = '#d32f2f';
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);
});

// ============================
// 初始化：检查是否有已存数据
// ============================
(function init() {
    const stored = localStorage.getItem('quizData');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            appData.units = parsed.units || [];
            appData.completedUnits = parsed.completedUnits || {};
            // 如果有题库，自动显示登录后直接进入单元列表？但需要用户登录，所以保留登录页
        } catch(e) {}
    }
    // 如果有用户信息，可以自动填充但保留登录
    showPage('page-login');
})();