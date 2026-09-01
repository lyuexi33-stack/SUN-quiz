
/* ================= 答题系统 逻辑 ================= */
var UNITS = 8;                    // 单元总数，可改
var UNIT_NAMES = buildUnitNames(UNITS);
var LETTERS = ['A', 'B', 'C', 'D'];
var ADMIN_PASSWORD = 'admin2026'; // 管理密码，可改

var user = null;       // {id, name}
var unit = 0;          // 当前单元
var questions = [];    // 当前单元题目
var qIndex = 0;        // 当前题序号
var answers = [];      // 每题答案
var submitted = false;
var parsed = null;     // 后台解析结果
var allRecords = [];   // 所有答题记录（管理员用）

function buildUnitNames(n) {
  var map = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
  var arr = [];
  for (var i = 1; i <= n; i++) {
    arr.push('第' + (map[i] || i) + '单元');
  }
  return arr;
}

/* ---------- 视图切换（核心：确保登录和单元选择完全分离）---------- */
function showView(id) {
  // 先隐藏所有视图
  document.querySelectorAll('.view').forEach(function (v) {
    v.classList.remove('active');
    v.style.display = 'none';
  });
  // 再显示目标视图
  var target = document.getElementById(id);
  target.classList.add('active');
  target.style.display = 'block';
  // 滚动到顶部
  window.scrollTo(0, 0);
}

function $(id) { return document.getElementById(id); }

function showToast(msg, isError) {
  var t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'show' + (isError ? ' err' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(function () { t.className = ''; }, 2600);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- 用户 & 记录 ---------- */
function getStudent() {
  try { var s = JSON.parse(localStorage.getItem('sun_student') || 'null'); return (s && s.id && s.name) ? s : null; }
  catch (e) { return null; }
}
function getRecord(id) {
  try { return JSON.parse(localStorage.getItem('sun_record_' + id) || '{}'); } catch (e) { return {}; }
}
function saveRecord(id, unit, data) {
  var r = getRecord(id); r[unit] = data;
  localStorage.setItem('sun_record_' + id, JSON.stringify(r));
}

/* ================= 登录 ================= */
$('btn-login').addEventListener('click', function () {
  var id = $('student-id').value.trim();
  var name = $('student-name').value.trim();
  if (!id || !name) { $('login-error').textContent = '请填写学号和姓名'; return; }
  user = { id: id, name: name };
  localStorage.setItem('sun_student', JSON.stringify(user));
  $('login-error').textContent = '';
  // 点击进入系统 → 跳转到单元选择界面
  enterUnits();
});

$('btn-logout').addEventListener('click', function () {
  localStorage.removeItem('sun_student');
  user = null;
  $('student-id').value = '';
  $('student-name').value = '';
  // 退出 → 返回登录界面
  showView('view-login');
});

/* ================= 单元列表 ================= */
function enterUnits() {
  // 显示单元选择界面（登录界面自动隐藏）
  showView('view-units');
  $('display-name').textContent = user.name;
  renderUnits();
}

function renderUnits() {
  var grid = $('unit-grid');
  var record = getRecord(user.id);
  var htmlArr = [];
  var jobs = [];
  for (var i = 1; i <= UNITS; i++) {
    (function (u) {
      jobs.push(
        fetch('data/unit' + u + '.json')
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; })
          .then(function (data) {
            var count = (data && Array.isArray(data.questions)) ? data.questions.length : 0;
            var rec = record[u];
            var status, disabled = false;
            if (count === 0) { status = '<span class="badge badge-empty">暂无题目</span>'; disabled = true; }
            else if (rec) { status = '<span class="badge badge-done">已完成 · ' + rec.score + ' 分</span>'; }
            else { status = '<span class="badge badge-todo">' + count + ' 道题 · 未作答</span>'; }
            htmlArr[u] =
              '<button class="unit-card' + (disabled ? ' disabled' : '') + '" data-unit="' + u + '"' + (disabled ? ' disabled' : '') + '>' +
              '<span class="unit-no">' + u + '</span>' +
              '<span class="unit-name">' + UNIT_NAMES[u - 1] + '</span>' +
              '<span class="unit-meta">' + (count > 0 ? '共 ' + count + ' 道题' : '题库待导入') + '</span>' +
              status +
              '</button>';
          })
      );
    })(i);
  }
  Promise.all(jobs).then(function () {
    grid.innerHTML = htmlArr.slice(1).join('');
    grid.querySelectorAll('.unit-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var u = parseInt(this.getAttribute('data-unit'), 10);
        openUnit(u);
      });
    });
  });
}

/* ================= 答题 ================= */
function openUnit(u) {
  unit = u;
  qIndex = 0;
  answers = [];
  submitted = false;
  // 显示答题界面（单元选择界面自动隐藏）
  showView('view-quiz');
  $('quiz-title').textContent = UNIT_NAMES[u - 1];
  $('quiz-progress').textContent = '加载中…';

  fetch('data/unit' + u + '.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; })
    .then(function (data) {
      questions = (data && Array.isArray(data.questions)) ? data.questions : [];
      if (!questions.length) {
        $('quiz-body').innerHTML = '<div class="empty-tip">该单元暂无题目，请联系管理员导入题库。</div>';
        $('quiz-nav').style.display = 'none';
        return;
      }
      $('quiz-nav').style.display = '';
      answers = questions.map(function () { return ''; });
      renderQuestion();
    });
}

function currentType(i) {
  return (questions[i].answer || '').length > 1 ? 'multi' : 'single';
}

function renderQuestion() {
  var q = questions[qIndex];
  var type = currentType(qIndex);
  var inputType = type === 'multi' ? 'checkbox' : 'radio';
  var opts = '';
  LETTERS.forEach(function (L, j) {
    var text = (q.options && q.options[j] != null) ? q.options[j] : '';
    if (!String(text).trim()) return;
    var checked = answers[qIndex].indexOf(L) >= 0 ? ' checked' : '';
    opts +=
      '<label class="option"><input type="' + inputType + '" name="opt" value="' + L + '"' + checked + '>' +
      '<span>' + L + '．' + escapeHtml(text) + '</span></label>';
  });
  $('quiz-body').innerHTML =
    '<div class="question-card">' +
    '<div class="q-head"><span class="q-no">' + (qIndex + 1) + '.</span>' +
    '<span class="q-text">' + escapeHtml(q.q) + '</span>' +
    '<span class="q-type q-type-' + type + '">' + (type === 'multi' ? '多选' : '单选') + '</span></div>' +
    '<div class="options">' + opts + '</div>' +
    '</div>';
  $('quiz-progress').textContent = (qIndex + 1) + ' / ' + questions.length;
  $('btn-prev').disabled = qIndex === 0;
  $('btn-next').style.display = qIndex === questions.length - 1 ? 'none' : '';
  $('btn-submit').style.display = qIndex === questions.length - 1 ? '' : 'none';
}

function collectCurrent() {
  var checked = Array.prototype.map.call(
    document.querySelectorAll('input[name="opt"]:checked'), function (el) { return el.value; }
  ).sort().join('');
  answers[qIndex] = checked;
}

$('btn-prev').addEventListener('click', function () {
  collectCurrent();
  if (qIndex > 0) { qIndex--; renderQuestion(); }
});
$('btn-next').addEventListener('click', function () {
  collectCurrent();
  if (qIndex < questions.length - 1) { qIndex++; renderQuestion(); }
});

$('btn-submit').addEventListener('click', function () {
  collectCurrent();
  var unanswered = [];
  answers.forEach(function (a, i) { if (!a) unanswered.push(i); });
  if (unanswered.length) {
    qIndex = unanswered[0]; renderQuestion();
    showToast('还有 ' + unanswered.length + ' 道题未作答，请完成后再交卷', true);
    return;
  }
  doSubmit();
});

function doSubmit() {
  submitted = true;
  var correct = 0;
  var questionDetails = [];  // 每题作答详情
  questions.forEach(function (q, i) {
    var ok = answers[i] === q.answer;
    if (ok) correct++;
    questionDetails.push({
      question: q.q,
      yourAnswer: answers[i] || '未作答',
      correctAnswer: q.answer,
      isCorrect: ok
    });
  });
  var total = questions.length;
  var score = Math.round(correct / total * 100);
  // 保存记录，包含每题作答详情
  saveRecord(user.id, unit, {
    score: score,
    total: total,
    correct: correct,
    time: new Date().toLocaleString('zh-CN'),
    answers: questionDetails
  });
  renderResult(correct, total, score);
}

function renderResult(correct, total, score) {
  var html =
    '<div class="score-card">' +
    '<div><div class="score-label">' + escapeHtml(UNIT_NAMES[unit - 1]) + ' · 成绩</div>' +
    '<div class="score-num">' + score + ' 分</div></div>' +
    '<div class="score-detail">答对 ' + correct + ' / ' + total + ' 题<br>' +
    '答题人：' + escapeHtml(user.name) + '（' + escapeHtml(user.id) + '）</div>' +
    '</div>';
  questions.forEach(function (q, i) {
    var ok = answers[i] === q.answer;
    var type = (q.answer || '').length > 1 ? '多选' : '单选';
    var opts = '';
    LETTERS.forEach(function (L, j) {
      var text = (q.options && q.options[j] != null) ? q.options[j] : '';
      if (!String(text).trim()) return;
      var cls = 'opt';
      if (q.answer.indexOf(L) >= 0) cls += ' correct-opt';
      else if (answers[i].indexOf(L) >= 0) cls += ' wrong-opt';
      opts += '<div class="' + cls + '">' + L + '．' + escapeHtml(text) +
        (q.answer.indexOf(L) >= 0 ? '  ✓ 正确答案' : (answers[i].indexOf(L) >= 0 ? '  ✗ 你的错选' : '')) + '</div>';
    });
    html +=
      '<div class="question-card review-item ' + (ok ? 'correct' : 'wrong') + '">' +
      '<div class="q-head"><span class="q-no">' + (i + 1) + '.</span>' +
      '<span class="q-text">' + escapeHtml(q.q) + '</span>' +
      '<span class="q-type q-type-' + ((q.answer || '').length > 1 ? 'multi' : 'single') + '">' + type + '</span></div>' +
      '<div class="review-status">' + (ok ? '<span class="ok">✓ 回答正确</span>' : '<span class="no">✗ 回答错误</span>') +
      '  <span class="review-ans"><span class="label">你的答案：</span>' +
      '<span class="your-a' + (ok ? '' : ' wrong') + '">' + (answers[i] || '未作答') + '</span>  ' +
      '<span class="label">正确答案：</span><span class="correct-a">' + q.answer + '</span></span></div>' +
      '<div class="review-options">' + opts + '</div>' +
      '</div>';
  });
  html += '<div class="quiz-nav"><div class="spacer"></div>' +
    '<button class="btn btn-outline" id="btn-retry">重新作答</button>' +
    '<button class="btn btn-primary" id="btn-back-units">返回单元列表</button></div>';
  $('quiz-body').innerHTML = html;
  $('quiz-nav').style.display = 'none';
  $('btn-retry').addEventListener('click', function () {
    submitted = false;
    qIndex = 0;
    answers = questions.map(function () { return ''; });
    $('quiz-nav').style.display = '';
    renderQuestion();
  });
  $('btn-back-units').addEventListener('click', enterUnits);
  window.scrollTo(0, 0);
}

$('btn-back').addEventListener('click', enterUnits);

/* ================= 我的成绩记录（学生端） ================= */
$('btn-records').addEventListener('click', function () {
  viewMyRecords();
});

function viewMyRecords() {
  showView('view-records');
  $('record-student-id').textContent = user.id;
  $('record-student-name').textContent = user.name;
  renderMyRecords();
}

function renderMyRecords() {
  var record = getRecord(user.id);
  var wrap = $('records-table-wrap');
  var empty = $('records-empty');
  var keys = Object.keys(record).sort();
  if (!keys.length) {
    wrap.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  var rows = '';
  keys.forEach(function (u) {
    var r = record[u];
    var unitName = UNIT_NAMES[parseInt(u) - 1] || '第' + u + '单元';
    rows += '<tr>' +
      '<td>' + u + '</td>' +
      '<td>' + unitName + '</td>' +
      '<td>' + (r.score || 0) + '</td>' +
      '<td>' + (r.total || 0) + '</td>' +
      '<td>' + (r.correct || 0) + '</td>' +
      '<td>' + (r.time || '') + '</td>' +
      '</tr>';
  });
  wrap.innerHTML = '<table class="records-table"><tr><th>单元号</th><th>单元名称</th><th>得分</th><th>总题数</th><th>答对</th><th>答题时间</th></tr>' + rows + '</table>';
}

/* ================= 题库管理 ================= */
$('btn-admin').addEventListener('click', function () {
  showView('view-admin');
  $('admin-pwd').style.display = '';
  $('admin-body').style.display = 'none';
  $('admin-pwd-input').value = '';
});
$('btn-admin-back').addEventListener('click', function () { enterUnits(); });

$('btn-admin-ok').addEventListener('click', function () {
  if ($('admin-pwd-input').value === ADMIN_PASSWORD) {
    $('admin-pwd').style.display = 'none';
    $('admin-body').style.display = '';
    fillUnitSelect();
    fillAdminUnitFilter();
    loadAllRecords();  // 管理员进入后台自动加载答题记录
  } else {
    showToast('密码错误', true);
  }
});

function fillUnitSelect() {
  var sel = $('unit-select');
  var html = '';
  for (var i = 1; i <= UNITS; i++) html += '<option value="' + i + '">' + i + '（' + UNIT_NAMES[i - 1] + '）</option>';
  sel.innerHTML = html;
}

function fillAdminUnitFilter() {
  var sel = $('admin-filter-unit');
  var html = '<option value="">全部单元</option>';
  for (var i = 1; i <= UNITS; i++) html += '<option value="' + i + '">' + UNIT_NAMES[i - 1] + '</option>';
  sel.innerHTML = html;
}

/* 加载所有答题记录 */
function loadAllRecords() {
  allRecords = [];
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key && key.indexOf('sun_record_') === 0) {
      var studentId = key.replace('sun_record_', '');
      try {
        var record = JSON.parse(localStorage.getItem(key));
        var studentName = '';
        // 尝试从 sun_student 中获取姓名（仅当当前用户匹配时）
        var currentStudent = JSON.parse(localStorage.getItem('sun_student') || 'null');
        if (currentStudent && currentStudent.id === studentId) {
          studentName = currentStudent.name;
        }
        var units = Object.keys(record).sort();
        units.forEach(function (u) {
          var r = record[u];
          var unitName = UNIT_NAMES[parseInt(u) - 1] || '第' + u + '单元';
          allRecords.push({
            studentId: studentId,
            studentName: studentName,
            unit: parseInt(u),
            unitName: unitName,
            score: r.score || 0,
            total: r.total || 0,
            correct: r.correct || 0,
            time: r.time || '',
            answers: r.answers || null
          });
        });
      } catch (e) { /* 忽略解析错误 */ }
    }
  }
  renderAdminRecords(allRecords);
}

/* 渲染管理员记录表格 */
function renderAdminRecords(records) {
  var wrap = $('admin-records-table-wrap');
  var empty = $('admin-records-empty');
  var count = $('admin-records-count');
  count.textContent = '共 ' + records.length + ' 条记录';
  if (!records.length) {
    wrap.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  var rows = '';
  records.forEach(function (r, idx) {
    var detailText = (r.answers && r.answers.length) ?
      r.answers.map(function (a, i) {
        return '第' + (i + 1) + '题:' + a.yourAnswer + '/' + a.correctAnswer + '/' + (a.isCorrect ? '正确' : '错误');
      }).join(' | ') : '未记录';
    rows += '<tr>' +
      '<td>' + escapeHtml(r.studentId) + '</td>' +
      '<td>' + escapeHtml(r.studentName) + '</td>' +
      '<td>' + r.unit + '</td>' +
      '<td>' + r.unitName + '</td>' +
      '<td>' + r.score + '</td>' +
      '<td>' + r.total + '</td>' +
      '<td>' + r.correct + '</td>' +
      '<td>' + r.time + '</td>' +
      '<td style="max-width:300px;overflow-x:auto;font-size:12px;">' + escapeHtml(detailText) + '</td>' +
      '<td><button class="btn btn-outline btn-sm" data-idx="' + idx + '">查看每题</button></td>' +
      '</tr>';
  });
  wrap.innerHTML = '<table class="records-table"><tr><th>学号</th><th>姓名</th><th>单元号</th><th>单元名称</th><th>得分</th><th>总题数</th><th>答对</th><th>答题时间</th><th>每题详情</th><th>操作</th></tr>' + rows + '</table>';
  // 绑定"查看每题"按钮
  wrap.querySelectorAll('.btn-sm').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var idx = parseInt(this.getAttribute('data-idx'), 10);
      showQuestionDetails(records[idx]);
    });
  });
}

/* 筛选记录 */
$('btn-filter').addEventListener('click', function () {
  var filterId = $('admin-filter-id').value.trim().toLowerCase();
  var filterUnit = $('admin-filter-unit').value;
  var filtered = allRecords.filter(function (r) {
    var matchId = !filterId || r.studentId.toLowerCase().indexOf(filterId) >= 0;
    var matchUnit = !filterUnit || r.unit === parseInt(filterUnit);
    return matchId && matchUnit;
  });
  renderAdminRecords(filtered);
});

/* 导出 Excel */
$('btn-export').addEventListener('click', function () {
  var filterId = $('admin-filter-id').value.trim().toLowerCase();
  var filterUnit = $('admin-filter-unit').value;
  var filtered = allRecords.filter(function (r) {
    var matchId = !filterId || r.studentId.toLowerCase().indexOf(filterId) >= 0;
    var matchUnit = !filterUnit || r.unit === parseInt(filterUnit);
    return matchId && matchUnit;
  });
  if (!filtered.length) { showToast('没有可导出的记录', true); return; }
  var rows = [
    ['学号', '姓名', '单元号', '单元名称', '得分', '总题数', '答对', '答题时间', '每题详情']
  ];
  filtered.forEach(function (r) {
    var detailText = (r.answers && r.answers.length) ?
      r.answers.map(function (a, i) {
        return '第' + (i + 1) + '题:' + a.yourAnswer + '/' + a.correctAnswer + '/' + (a.isCorrect ? '正确' : '错误');
      }).join(' | ') : '未记录';
    rows.push([
      r.studentId, r.studentName, r.unit, r.unitName,
      r.score, r.total, r.correct, r.time, detailText
    ]);
  });
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [14, 10, 8, 12, 8, 8, 8, 20, 80];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '答题记录');
  XLSX.writeFile(wb, '答题记录.xlsx');
  showToast('已导出 Excel');
});

/* 查看每题作答详情 */
function showQuestionDetails(record) {
  $('admin-records-card').style.display = 'none';
  $('admin-detail-card').style.display = '';
  $('admin-detail-title').textContent = record.studentName + '（' + record.studentId + '）· ' + record.unitName + ' · 每题详情';
  var content = $('admin-detail-content');
  if (!record.answers || !record.answers.length) {
    content.innerHTML = '<div class="empty-tip">该记录未保存每题作答详情</div>';
    return;
  }
  var rows = '';
  record.answers.forEach(function (a, i) {
    var cls = a.isCorrect ? 'detail-correct' : 'detail-wrong';
    rows += '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + escapeHtml(a.question) + '</td>' +
      '<td>' + escapeHtml(a.yourAnswer) + '</td>' +
      '<td>' + escapeHtml(a.correctAnswer) + '</td>' +
      '<td class="' + cls + '">' + (a.isCorrect ? '正确' : '错误') + '</td>' +
      '</tr>';
  });
  content.innerHTML = '<table class="records-table"><tr><th>#</th><th>题目</th><th>你的答案</th><th>正确答案</th><th>结果</th></tr>' + rows + '</table>';
}

$('btn-detail-back').addEventListener('click', function () {
  $('admin-detail-card').style.display = 'none';
  $('admin-records-card').style.display = '';
});

/* ================= 题库模板 ================= */
$('btn-template').addEventListener('click', function () {
  var rows = [
    ['题干', '选项A', '选项B', '选项C', '选项D', '答案'],
    ['中国的首都是哪座城市？', '上海', '北京', '广州', '深圳', 'B'],
    ['下列属于哺乳动物的有', '鲸鱼', '鲨鱼', '蝙蝠', '鳄鱼', 'AC']
  ];
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '题库');
  XLSX.writeFile(wb, '题库模板.xlsx');
  showToast('模板已下载');
});

$('btn-parse').addEventListener('click', function () {
  var file = $('file-input').files[0];
  if (!file) { showToast('请先选择 xlsx 文件', true); return; }
  var targetUnit = parseInt($('unit-select').value, 10);
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      parsed = parseRows(targetUnit, rows);
      renderParseResult();
    } catch (err) { showToast('解析失败：' + err.message, true); }
  };
  reader.readAsArrayBuffer(file);
});

function pick(row, candidates) {
  var keys = Object.keys(row);
  for (var c = 0; c < candidates.length; c++)
    for (var k = 0; k < keys.length; k++)
      if (keys[k].replace(/\s+/g, '') === candidates[c]) return row[keys[k]];
  return undefined;
}

function parseRows(targetUnit, rows) {
  var qs = [], errs = [];
  if (!rows.length) return { unit: targetUnit, questions: qs, errors: ['表格中没有数据行'] };
  rows.forEach(function (row, idx) {
    var line = '第 ' + (idx + 2) + ' 行：';
    var q = String(pick(row, ['题干', '题目', '题面', '问题']) || '').trim();
    var opts = LETTERS.map(function (L) { var v = pick(row, ['选项' + L, L]); return v == null ? '' : String(v).trim(); });
    var raw = pick(row, ['答案', '正确答案', '参考答案']);
    raw = raw == null ? '' : String(raw).trim();
    var rowErr = [];
    if (!q) rowErr.push('题干为空');
    if (!opts[0] || !opts[1]) rowErr.push('选项A/B为空');
    if (!raw) rowErr.push('答案为空');
    var letters = (raw.toUpperCase().match(/[A-D]/g) || []);
    letters = LETTERS.filter(function (L) { return letters.indexOf(L) >= 0; });
    var answer = letters.join('');
    if (raw && !answer) rowErr.push('答案未识别到 A-D');
    letters.forEach(function (L) { if (!opts[LETTERS.indexOf(L)]) rowErr.push('答案含 ' + L + ' 但选项' + L + '为空'); });
    if (rowErr.length) { errs.push(line + rowErr.join('；')); return; }
    qs.push({ q: q, options: opts, answer: answer, type: answer.length > 1 ? 'multi' : 'single' });
  });
  return { unit: targetUnit, questions: qs, errors: errs };
}

function renderParseResult() {
  var box = $('parse-result');
  var nSingle = parsed.questions.filter(function (q) { return q.type === 'single'; }).length;
  var nMulti = parsed.questions.length - nSingle;
  var html = '';
  if (parsed.errors.length)
    html += '<div class="err-list"><b>⚠ ' + parsed.errors.length + ' 个问题（已跳过）：</b><br>' + parsed.errors.map(escapeHtml).join('<br>') + '</div>';
  if (parsed.questions.length)
    html += '<div class="ok-list"><b>✓ 解析 ' + parsed.questions.length + ' 道题</b>（单选 ' + nSingle + '，多选 ' + nMulti + '），目标：' + UNIT_NAMES[parsed.unit - 1] + '</div>';
  else
    html += '<div class="err-list">没有有效题目，请检查列名（题干、选项A-D、答案）</div>';
  box.innerHTML = html;
  if (parsed.questions.length) {
    $('preview-card').style.display = '';
    var rowsHtml = parsed.questions.map(function (q, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(q.q) + '</td><td>' +
        LETTERS.map(function (L, j) { return q.options[j] ? L + '．' + escapeHtml(q.options[j]) : ''; }).filter(Boolean).join('<br>') +
        '</td><td>' + q.answer + '</td><td>' + (q.type === 'multi' ? '多选' : '单选') + '</td></tr>';
    }).join('');
    $('preview-area').innerHTML = '<table class="preview"><tr><th>#</th><th>题干</th><th>选项</th><th>答案</th><th>题型</th></tr>' + rowsHtml + '</table>';
    $('btn-download').textContent = '下载 unit' + parsed.unit + '.json';
  } else {
    $('preview-card').style.display = 'none';
  }
}

$('btn-download').addEventListener('click', function () {
  if (!parsed || !parsed.questions.length) return;
  var data = {
    unit: parsed.unit,
    title: UNIT_NAMES[parsed.unit - 1],
    updatedAt: new Date().toISOString(),
    questions: parsed.questions.map(function (q) { return { q: q.q, options: q.options, answer: q.answer }; })
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'unit' + parsed.unit + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  showToast('已下载，请上传到仓库 data 目录');
});

/* ================= 启动 ================= */
(function init() {
  // 始终先显示登录界面，确保登录和单元选择完全分离
  showView('view-login');
  // 不再自动登录，用户必须手动点击"进入系统"
})();
