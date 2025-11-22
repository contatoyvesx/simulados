const SIMULADOS = [
  { id: '1', nome: 'Simulado 1', simuladoPath: '1/SIMULADO 1.txt', gabaritoPath: '1/GABARITO 1.txt' },
  { id: '2', nome: 'Simulado 2', simuladoPath: '2 - corrigido/SIMULADO 2.txt', gabaritoPath: '2 - corrigido/GABARITO 2.txt' },
  { id: '3', nome: 'Simulado 3', simuladoPath: '3 - corrigido/SIMULADO 3.txt', gabaritoPath: '3 - corrigido/GABARITO 3.txt' },
  { id: '4', nome: 'Simulado 4', simuladoPath: '4 - corrigido/SIMULADO 4.txt', gabaritoPath: '4 - corrigido/GABARITO 4.txt' },
  { id: '5', nome: 'Simulado 5', simuladoPath: '5 - corrigido/SIMULADO 5.txt', gabaritoPath: '5 - corrigido/GABARITO 5.txt' },
  { id: '6', nome: 'Simulado 6', simuladoPath: '6 - corrigido/SIMULADO 6.txt', gabaritoPath: '6 - corrigido/GABARITO 6.txt' },
  { id: '7', nome: 'Simulado 7', simuladoPath: '7 - corrigido/SIMULADO 7.txt', gabaritoPath: '7 - corrigido/GABARITO 7.txt' },
  { id: '8', nome: 'Simulado 8', simuladoPath: '8 - corrigido/SIMULAO 8.txt', gabaritoPath: '8 - corrigido/GABARITO 8.txt' },
  { id: 'roman-all', nome: 'Todas as provas (apenas romanos)', aggregate: true }
];

const BASE_SIMULADOS = SIMULADOS.filter((item) => !item.aggregate);

const select = document.getElementById('simuladoSelect');
const startButton = document.getElementById('startButton');
const loadStatus = document.getElementById('loadStatus');
const questionPanel = document.getElementById('questionPanel');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const progressLabel = document.getElementById('progressLabel');
const questionTitle = document.getElementById('questionTitle');
const feedback = document.getElementById('feedback');
const checkButton = document.getElementById('checkButton');
const nextButton = document.getElementById('nextButton');
const scoreBoard = document.getElementById('scoreBoard');
const sessionInfo = document.getElementById('sessionInfo');
const summaryPanel = document.getElementById('summaryPanel');
const summaryText = document.getElementById('summaryText');
const summaryList = document.getElementById('summaryList');
const restartButton = document.getElementById('restartButton');
const displayMode = document.getElementById('displayMode');
const questionFilter = document.getElementById('questionFilter');

let currentSimulado = null;
let questions = [];
let currentIndex = 0;
let answered = new Map();

function populateSelect() {
  SIMULADOS.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.nome;
    select.appendChild(option);
  });
}

populateSelect();

async function loadFile(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Não foi possível carregar ${path}`);
  }
  return response.text();
}

function parseAnswerKey(text) {
  const lines = text.split(/\r?\n/);
  const answers = new Map();

  lines.forEach((line) => {
    const numberMatch = line.match(/^\s*(\d+)/);
    if (!numberMatch) return;

    const letterMatch =
      line.match(/\b([A-Da-d])(?=[).])/)
      || line.match(/\b([A-Da-d])\b/);

    if (letterMatch) {
      answers.set(Number(numberMatch[1]), letterMatch[1].toUpperCase());
    }
  });

  return answers;
}

function parseQuestions(text, answers) {
  const lines = text.split(/\r?\n/);
  const questionRegex = /^\s*(\d+)\.\s*(.*)$/;
  const optionRegex = /^\s*([A-Da-d])[.)]\s*(.*)$/;
  const parsed = [];

  const cleanText = (value) => value.replace(/<br\s*\/?>/gi, '\n');

  let current = null;

  const pushCurrent = () => {
    if (current) {
      current.text = cleanText(current.promptParts.join('\n').trim());
      current.correct = answers.get(current.number) || null;
      parsed.push(current);
    }
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();

    const questionMatch = line.match(questionRegex);
    if (questionMatch) {
      pushCurrent();
      const [, number, rest] = questionMatch;
      current = {
        number: Number(number),
        promptParts: [rest.trim()],
        options: []
      };
      return;
    }

    if (!current) return;

    const optionMatch = line.match(optionRegex);
    if (optionMatch && optionMatch[2]) {
      current.options.push({
        letter: optionMatch[1].toUpperCase(),
        text: cleanText(optionMatch[2].trim())
      });
      return;
    }

    if (line && current.options.length > 0) {
      const last = current.options[current.options.length - 1];
      last.text = `${last.text}\n${cleanText(line.trim())}`;
    } else {
      current.promptParts.push(line);
    }
  });

  pushCurrent();
  return parsed;
}

function containsRomanNumerals(text) {
  if (!text) return false;
  const normalized = text.replace(/\s+/g, ' ');
  const romanPattern = /\b[IVXLCDM]{1,4}\b/i;
  const typoFriendlyPattern = /\bI[lL]{1,2}\b/;
  return romanPattern.test(normalized) || typoFriendlyPattern.test(normalized);
}

function filterQuestionsByMode(allQuestions) {
  if (questionFilter.value !== 'roman') return allQuestions;

  return allQuestions.filter((q) => containsRomanNumerals(q.text));
}

async function buildAggregateRomanQuestions() {
  const aggregated = [];

  for (const simulado of BASE_SIMULADOS) {
    const [simText, gabText] = await Promise.all([
      loadFile(simulado.simuladoPath),
      loadFile(simulado.gabaritoPath)
    ]);

    const answers = parseAnswerKey(gabText);
    const parsed = parseQuestions(simText, answers)
      .map((q) => ({ ...q, source: simulado.nome, originalNumber: q.number }))
      .filter((q) => containsRomanNumerals(q.text));

    aggregated.push(...parsed);
  }

  return aggregated.map((q, idx) => ({ ...q, number: idx + 1 }));
}

function renderQuestion(index) {
  const q = questions[index];
  const sourceLabel = q.source ? ` — ${q.source}` : '';
  const originalLabel = q.originalNumber && q.originalNumber !== q.number
    ? ` (original ${q.originalNumber})`
    : '';

  questionTitle.textContent = `Questão ${q.number}${sourceLabel}${originalLabel}`;
  questionText.textContent = q.text || 'Sem enunciado disponível';

  progressLabel.textContent = `Progresso: ${index + 1} / ${questions.length}`;
  scoreBoard.textContent = `Acertos: ${Array.from(answered.values()).filter((v) => v.correct).length}`;

  optionsContainer.innerHTML = '';
  feedback.textContent = '';
  feedback.className = 'feedback';

  q.options.forEach((opt, idx) => {
    const optionId = `q${q.number}-opt${idx}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'option';
    input.value = opt.letter;
    input.id = optionId;

    const label = document.createElement('label');
    label.setAttribute('for', optionId);
    label.textContent = `${opt.letter}) ${opt.text}`;

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    optionsContainer.appendChild(wrapper);
  });

  checkButton.disabled = false;
  nextButton.disabled = true;
  nextButton.textContent = index + 1 === questions.length ? 'Finalizar simulado' : 'Próxima questão';
}

function showSummary() {
  const total = questions.length;
  const hits = Array.from(answered.values()).filter((v) => v.correct).length;
  summaryText.textContent = `Você acertou ${hits} de ${total} questões.`;
  summaryList.innerHTML = '';

  questions.forEach((q) => {
    const record = answered.get(q.number);
    const div = document.createElement('div');
    div.className = `summary-item ${record && record.correct ? 'correct' : 'incorrect'}`;
    const sourceLabel = q.source ? ` — ${q.source}` : '';
    div.innerHTML = `<span>Questão ${q.number}${sourceLabel}</span><span>${record?.chosen || '-'} / ${q.correct || '?'}</span>`;
    summaryList.appendChild(div);
  });

  questionPanel.hidden = true;
  summaryPanel.hidden = false;
  sessionInfo.textContent = 'Simulado concluído';
}

function guardBeforeNext() {
  if (!answered.has(questions[currentIndex].number)) {
    feedback.textContent = 'Confira a resposta antes de seguir adiante.';
    feedback.className = 'feedback error';
    return false;
  }
  return true;
}

async function startSimulado() {
  const selectedId = select.value;
  const simulado = SIMULADOS.find((item) => item.id === selectedId);
  if (!simulado) return;

  loadStatus.textContent = 'Carregando arquivos...';
  questionPanel.hidden = true;
  summaryPanel.hidden = true;
  sessionInfo.textContent = 'Preparando questões';

  try {
    let filterLabel = '';

    if (simulado.aggregate) {
      questions = await buildAggregateRomanQuestions();

      if (questions.length === 0) {
        throw new Error('Nenhuma questão com numerais romanos encontrada em todos os simulados.');
      }

      filterLabel = ' (questões com algarismos romanos de todos os simulados)';
      currentSimulado = { nome: simulado.nome };
      questionFilter.value = 'roman';
    } else {
      const [simText, gabText] = await Promise.all([
        loadFile(simulado.simuladoPath),
        loadFile(simulado.gabaritoPath)
      ]);

      const answers = parseAnswerKey(gabText);
      const parsedQuestions = parseQuestions(simText, answers)
        .map((q) => ({ ...q, source: simulado.nome, originalNumber: q.number }));
      questions = filterQuestionsByMode(parsedQuestions);

      if (questions.length === 0) {
        const filterMessage =
          questionFilter.value === 'roman'
            ? 'Nenhuma questão com numerais romanos encontrada.'
            : 'Nenhuma questão encontrada.';
        throw new Error(filterMessage);
      }

      const filteredOut = parsedQuestions.length - questions.length;
      filterLabel =
        questionFilter.value === 'roman'
          ? ` (${filteredOut} questões sem numerais romanos foram ocultadas)`
          : '';
      currentSimulado = simulado;
    }

    if (displayMode.value === 'all') {
      questionText.textContent = questions.map((q) => {
        const headerSource = q.source ? `${q.source} — ` : '';
        const headerNumber = q.originalNumber ? `Questão ${q.originalNumber}` : `Questão ${q.number}`;
        const options = q.options.map((o) => `${o.letter}) ${o.text}`).join('\n');
        return `${headerSource}${headerNumber}\n${q.text}\n${options}`;
      }).join('\n\n');
      optionsContainer.innerHTML = '';
      checkButton.disabled = true;
      nextButton.disabled = true;
      feedback.textContent = 'O modo completo exibe todas as questões para leitura rápida. Use o modo "Uma questão por vez" para responder e validar.';
      feedback.className = 'feedback';
      questionTitle.textContent = 'Visualização completa';
      progressLabel.textContent = `${questions.length} questões carregadas`;
      scoreBoard.textContent = '';
      questionPanel.hidden = false;
      summaryPanel.hidden = true;
      return;
    }

    currentIndex = 0;
    answered = new Map();
    renderQuestion(currentIndex);
    questionPanel.hidden = false;
    summaryPanel.hidden = false;
    summaryPanel.hidden = true;
    sessionInfo.textContent = `${simulado.nome} carregado`;
    loadStatus.textContent = `${questions.length} questões prontas para responder.${filterLabel}`;
  } catch (error) {
    console.error(error);
    loadStatus.textContent = error.message;
  }
}

function checkCurrent() {
  const q = questions[currentIndex];
  const selected = optionsContainer.querySelector('input[name="option"]:checked');
  if (!selected) {
    feedback.textContent = 'Selecione uma alternativa para corrigir.';
    feedback.className = 'feedback error';
    return;
  }

  const chosen = selected.value.toUpperCase();
  const correct = q.correct === chosen;

  answered.set(q.number, { chosen, correct });

  feedback.textContent = correct ? 'Resposta correta! Parabéns.' : `Resposta incorreta. O gabarito indica ${q.correct}.`;
  feedback.className = `feedback ${correct ? 'success' : 'error'}`;

  checkButton.disabled = false;
  nextButton.disabled = false;
  scoreBoard.textContent = `Acertos: ${Array.from(answered.values()).filter((v) => v.correct).length}`;

  optionsContainer.querySelectorAll('input[name="option"]').forEach((input) => {
    input.disabled = true;
    const label = optionsContainer.querySelector(`label[for="${input.id}"]`);
    if (input.value === q.correct) {
      label.style.color = 'var(--success)';
    }
  });
}

function goNext() {
  if (!guardBeforeNext()) return;

  if (currentIndex + 1 >= questions.length) {
    showSummary();
    return;
  }

  currentIndex += 1;
  renderQuestion(currentIndex);
}

startButton.addEventListener('click', startSimulado);
checkButton.addEventListener('click', checkCurrent);
nextButton.addEventListener('click', goNext);
restartButton.addEventListener('click', () => {
  questionPanel.hidden = true;
  summaryPanel.hidden = true;
  sessionInfo.textContent = 'Escolha um simulado para começar';
  loadStatus.textContent = 'Nenhum simulado carregado';
});
