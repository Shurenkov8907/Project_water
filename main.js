// -------------------- Классы --------------------
class Node {
  constructor(id, x, y, flow) {
    this.id = parseInt(id);
    this.x = parseFloat(x);
    this.y = parseFloat(y);
    this.flow = parseFloat(flow);
  }
}

class Pipe {
  constructor(startNode, endNode, pipeName = null) {
    this.startNode = startNode;
    this.endNode = endNode;
    this.pipeName = pipeName;
    this.length = this.calculateLength();
  }
  
  calculateLength() {
    const dx = this.endNode.x - this.startNode.x;
    const dy = this.endNode.y - this.startNode.y;
    return parseFloat(Math.sqrt(dx * dx + dy * dy).toFixed(2));
  }
}

// -------------------- Глобальные переменные --------------------
const pipeTypes = []; // Данные из pipes.json
let nodes = [];
let pipes = [];


document.addEventListener("DOMContentLoaded", () => {
  loadPipesJSON();

  // Переключение отображения секции выбора диаметра для пластиковых труб
  document.getElementById("material").addEventListener("change", function() {
    document.getElementById("diameterSection").style.display = 
      this.value === "plastic" ? "block" : "none";
  });

  document.getElementById("addNodeBtn").addEventListener("click", addNode);
  document.getElementById("addConnectionBtn").addEventListener("click", addConnection);
  document.getElementById("buildNetworkBtn").addEventListener("click", buildNetwork);
  document.getElementById("solveMatrixBtn").addEventListener("click", solveSystem);
  document.getElementById("toggleDetailedSolutionBtn").addEventListener("click", toggleDetailedSolution);
});

// -------------------- Загрузка pipes.json --------------------
function loadPipesJSON() {
  fetch("pipes.json")
    .then(response => {
      if (!response.ok) {
        throw new Error("Ошибка загрузки pipes.json: " + response.statusText);
      }
      return response.json();
    })
    .then(data => {
      pipeTypes.length = 0;
      const diameterSelect = document.getElementById("diameter");
      diameterSelect.innerHTML = '';
      
      data.forEach(pipe => {
        pipeTypes.push(pipe);
        const option = new Option(
          `${pipe.name} (${pipe.diameter} мм)`, 
          pipe.name
        );
        diameterSelect.add(option);
      });
    })
    .catch(error => {
      console.error("Ошибка при загрузке JSON:", error);
      alert("Не удалось загрузить данные о трубах. Проверьте наличие файла pipes.json");
    });
}

// -------------------- Добавление узлов --------------------
function addNode() {
  const id = document.getElementById("nodeId").value.trim();
  const x = document.getElementById("nodeX").value.trim();
  const y = document.getElementById("nodeY").value.trim();
  const flow = document.getElementById("nodeFlow").value.trim();

  if (!id || !x || !y || !flow) {
    alert("Заполните все поля узла корректными данными!");
    return;
  }

  if (nodes.some(node => node.id == id)) {
    alert("Узел с таким ID уже существует!");
    return;
  }

  const node = new Node(id, x, y, flow);
  nodes.push(node);

  const nodeList = document.getElementById("nodeList");
  if (nodeList) {
    const li = document.createElement("li");
    li.textContent = `Узел ${node.id}: (${node.x}, ${node.y}), Расход: ${node.flow} л/с`;
    nodeList.appendChild(li);
  }

  updateNodeSelects();
  clearNodeInputs();
  buildNetwork();
}

function updateNodeSelects() {
  const startSelect = document.getElementById("startNode");
  const endSelect = document.getElementById("endNode");
  startSelect.innerHTML = "";
  endSelect.innerHTML = "";
  
  if (nodes.length === 0) {
    startSelect.disabled = true;
    endSelect.disabled = true;
    return;
  }
  
  startSelect.disabled = false;
  endSelect.disabled = false;
  
  nodes.forEach(node => {
    const option = new Option(`Узел ${node.id}`, node.id);
    startSelect.add(option.cloneNode(true));
    endSelect.add(option.cloneNode(true));
  });
}

function clearNodeInputs() {
  document.getElementById("nodeId").value = "";
  document.getElementById("nodeX").value = "";
  document.getElementById("nodeY").value = "";
  document.getElementById("nodeFlow").value = "";
}

// -------------------- Добавление соединений --------------------
function addConnection() {
  const material = document.getElementById("material").value;
  if (material === "steel") {
    alert("Данные для стальных труб временно недоступны");
    return;
  }
  
  const startId = document.getElementById("startNode").value;
  const endId = document.getElementById("endNode").value;
  const pipeName = document.getElementById("diameter").value;

  if (!startId || !endId || startId === endId) {
    alert("Выберите два различных узла для соединения");
    return;
  }

  const startNode = nodes.find(n => n.id == startId);
  const endNode = nodes.find(n => n.id == endId);
  if (!startNode || !endNode) {
    alert("Ошибка: не найдены выбранные узлы!");
    return;
  }

  // Проверка на дубликат соединения
  const duplicate = pipes.find(pipe => 
    (pipe.startNode.id == startId && pipe.endNode.id == endId) ||
    (pipe.startNode.id == endId && pipe.endNode.id == startId)
  );
  
  if (duplicate) {
    alert("Такое соединение уже существует!");
    return;
  }

  const pipe = new Pipe(startNode, endNode, pipeName);
  pipes.push(pipe);

  const connectionList = document.getElementById("connectionList");
  if (connectionList) {
    const li = document.createElement("li");
    li.textContent = `Соединение: ${startId} → ${endId} | Длина: ${pipe.length} м | Труба: ${pipe.pipeName}`;
    connectionList.appendChild(li);
  }

  buildNetwork();
}

// -------------------- Построение схемы на Canvas --------------------
function buildNetwork() {
  const canvas = document.getElementById("networkCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Находим границы сети для масштабирования
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  nodes.forEach(node => {
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.y > maxY) maxY = node.y;
  });

  // Добавляем отступы
  const padding = 50;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  // Масштабируем координаты
  const scaleX = canvas.width / (maxX - minX);
  const scaleY = canvas.height / (maxY - minY);
  const scale = Math.min(scaleX, scaleY);

  function transformX(x) {
    return (x - minX) * scale;
  }

  function transformY(y) {
    return canvas.height - (y - minY) * scale;
  }

  // Отрисовка труб
  pipes.forEach(pipe => {
    const startX = transformX(pipe.startNode.x);
    const startY = transformY(pipe.startNode.y);
    const endX = transformX(pipe.endNode.x);
    const endY = transformY(pipe.endNode.y);
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Отрисовка отметки длины трубы
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    ctx.fillStyle = "#2c3e50";
    ctx.font = "12px Arial";
    ctx.fillText(`${pipe.length} м`, midX + 10, midY);
  });

  // Отрисовка узлов
  nodes.forEach(node => {
    const x = transformX(node.x);
    const y = transformY(node.y);
    
    // Рисуем узел
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = "#e74c3c";
    ctx.fill();
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Подпись узла
    ctx.font = "14px Arial";
    ctx.fillStyle = "#2c3e50";
    ctx.fillText(`Узел ${node.id}`, x + 15, y - 15);
    
    // Расход
    ctx.font = "12px Arial";
    ctx.fillStyle = "#27ae60";
    ctx.fillText(`${node.flow} л/с`, x + 15, y + 5);
  });
}

// -------------------- Гидравлический расчет --------------------
function calculateHydraulics(pipe, flowRate) {
  const material = document.getElementById("material").value;
  const pipeType = pipeTypes.find(pt => pt.name === pipe.pipeName);
  
  if (!pipeType) {
    console.error("Не найдены данные для трубы:", pipe.pipeName);
    return {
      velocity: "N/A",
      headLoss: "N/A",
      reynolds: "N/A",
      lam: 0,
      diameterMeters: 0
    };
  }
  
  const diameter = pipeType.diameter;
  const diameterMeters = diameter / 1000;
  const flowRateM3 = Math.abs(flowRate) / 1000;
  
  const velocity = (4 * flowRateM3) / (Math.PI * Math.pow(diameterMeters, 2));
  
  let Re = (velocity * diameterMeters) / 1.31e-6;
  
  let lam;
  if (material === "steel") {
    lam = (0.0159 / Math.pow(diameterMeters, 0.226)) *
          Math.pow(1.0 + (0.684 / velocity), 0.226);
  } else {
    const Rekv = (500 * diameterMeters) / 0.00014;
    let b = 1 + (Math.log10(Re) / Math.log10(Rekv));
    b = b > 2 ? 2 : b;
    const logPart = Math.log10((3.7 * diameterMeters) / 0.00014);
    lam = Math.pow((0.5 * ((b / 2) + (1.312 * (2 - b) * logPart / (Math.log10(Re) - 1))) / logPart), 2);
  }
  
  const g = 9.8;
  const headLoss = lam * Math.pow(velocity, 2) / (2 * g * diameterMeters) * pipe.length;
  
  return {
    velocity: velocity.toFixed(2),
    headLoss: headLoss.toFixed(2),
    reynolds: Re.toFixed(0),
    lam: lam,
    diameterMeters: diameterMeters
  };
}

// -------------------- Решение системы уравнений --------------------
function solveSystem() {
  if (nodes.length < 2 || pipes.length === 0) {
    alert("Добавьте минимум 2 узла и 1 соединение для расчёта.");
    return;
  }

  const mUnknowns = pipes.length;
  let mat = [];
  
  // Уравнения баланса расходов в узлах
  for (let i = 1; i < nodes.length; i++) {
    let row = new Array(mUnknowns + 1).fill(0);
    
    pipes.forEach((pipe, j) => {
      if (pipe.startNode.id === nodes[i].id) {
        row[j] = -1;
      } else if (pipe.endNode.id === nodes[i].id) {
        row[j] = 1;
      }
    });
    
    row[mUnknowns] = Math.abs(parseFloat(nodes[i].flow));
    mat.push(row);
  }

  // Уравнения баланса напоров в контурах
  const cycles = computeCycles();
  cycles.forEach(cycleRow => {
    let row = cycleRow.slice();
    row.push(0);
    mat.push(row);
  });

  let logText = "=== Начало решения системы ===\n\n";
  logText += "Исходная матрица системы:\n" + matrixToString(mat) + "\n";

  // Метод Гаусса
  const n = mUnknowns;
  for (let i = 0; i < n; i++) {
    // Поиск ведущего элемента
    let pivot = i;
    for (let j = i; j < n; j++) {
      if (Math.abs(mat[j][i]) > Math.abs(mat[pivot][i])) {
        pivot = j;
      }
    }
    
    if (Math.abs(mat[pivot][i]) < 1e-8) {
      document.getElementById("solutionSection").innerText = "Матрица вырождена на шаге " + i;
      return;
    }
    
    // Перестановка строк
    if (pivot !== i) {
      [mat[i], mat[pivot]] = [mat[pivot], mat[i]];
      logText += `Обмен строк ${i+1} и ${pivot+1}:\n${matrixToString(mat)}\n`;
    }
    
    // Нормализация строки
    const pivotVal = mat[i][i];
    for (let k = i; k < n + 1; k++) {
      mat[i][k] /= pivotVal;
    }
    logText += `Нормализация строки ${i+1} (делим на ${pivotVal.toFixed(4)}):\n${matrixToString(mat)}\n`;
    
    // Исключение переменной
    for (let j = 0; j < n; j++) {
      if (j !== i && Math.abs(mat[j][i]) > 1e-8) {
        const factor = mat[j][i];
        for (let k = i; k < n + 1; k++) {
          mat[j][k] -= factor * mat[i][k];
        }
        logText += `Исключение в строке ${j+1} (вычитаем ${factor.toFixed(4)} * строку ${i+1}):\n${matrixToString(mat)}\n`;
      }
    }
  }

  // Первичное решение
  let solution = new Array(n);
  for (let i = 0; i < n; i++) {
    solution[i] = mat[i][n];
  }
  
  logText += "\nПервичное решение (расходы по участкам):\n";
  solution.forEach((val, index) => {
    logText += `Участок ${index+1}: ${val.toFixed(4)} л/с\n`;
  });

  // Корректировка по контурам
  let correctedSolution = solution.slice();
  cycles.forEach((cycleRow, cycleIndex) => {
    let iteration = 0;
    let h_delta = 0;
    const indices = [];
    cycleRow.forEach((coeff, i) => {
      if (coeff !== 0) indices.push(i);
    });
    
    do {
      h_delta = 0;
      indices.forEach(i => {
        const pipe = pipes[i];
        const q = correctedSolution[i];
        const hyd = calculateHydraulics(pipe, q);
        let headLoss = parseFloat(hyd.headLoss) || 0;
        h_delta += cycleRow[i] * headLoss;
      });
      
      iteration++;
      if (Math.abs(h_delta) > 0.5 && iteration < 20) {
        indices.forEach(i => {
          const pipe = pipes[i];
          const q = correctedSolution[i];
          const hyd = calculateHydraulics(pipe, q);
          const lam = hyd.lam;
          const d = hyd.diameterMeters;
          
          let q_delta = 0;
          if (q !== 0 && d !== 0) {
            q_delta = h_delta / (2 * (((8 * lam) / Math.pow(Math.PI, 2)) * 9.8 * Math.pow(d, 5) * q));
            const maxChange = 0.05 * q;
            q_delta = Math.min(Math.max(q_delta, -maxChange), maxChange);
          }
          
          correctedSolution[i] = q - cycleRow[i] * q_delta;
        });
      }
    } while (Math.abs(h_delta) > 0.5 && iteration < 20);
    
    logText += `\nКонтур ${cycleIndex+1}: ${iteration} итераций, остаточная невязка = ${h_delta.toFixed(4)} м\n`;
  });

  logText += "\nИтоговое решение (после корректировки):\n";
  correctedSolution.forEach((val, index) => {
    logText += `Участок ${index+1}: ${val.toFixed(4)} л/с\n`;
  });

  // Отображение результатов
  displayResults(solution, correctedSolution, logText);
}

function displayResults(solution, correctedSolution, logText) {
  const tbody = document.getElementById("solutionTable").querySelector("tbody");
  tbody.innerHTML = "";
  
  pipes.forEach((pipe, i) => {
    const hyd = calculateHydraulics(pipe, solution[i]);
    const tr = document.createElement("tr");
    
    tr.innerHTML = `
      <td>${pipe.startNode.id} → ${pipe.endNode.id} (${pipe.pipeName})</td>
      <td>${solution[i].toFixed(4)}</td>
      <td>${hyd.velocity}</td>
      <td>${hyd.headLoss}</td>
      <td>${hyd.reynolds}</td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // Таблица с корректированными значениями
  let correctionTable = document.getElementById("correctionResults");
  if (!correctionTable) {
    correctionTable = document.createElement("div");
    correctionTable.id = "correctionResults";
    document.querySelector(".results-section").appendChild(correctionTable);
  }
  
  correctionTable.innerHTML = `
    <h3>Результаты после корректировки</h3>
    <table>
      <thead>
        <tr>
          <th>Участок</th>
          <th>Расход (л/с)</th>
          <th>Потери напора (м)</th>
        </tr>
      </thead>
      <tbody id="correctedResultsBody"></tbody>
    </table>
  `;
  
  const correctedTbody = document.getElementById("correctedResultsBody");
  pipes.forEach((pipe, i) => {
    const hyd = calculateHydraulics(pipe, correctedSolution[i]);
    const tr = document.createElement("tr");
    
    tr.innerHTML = `
      <td>${pipe.startNode.id} → ${pipe.endNode.id}</td>
      <td>${correctedSolution[i].toFixed(4)}</td>
      <td>${hyd.headLoss}</td>
    `;
    
    correctedTbody.appendChild(tr);
  });
  
  // Подробное решение
  document.getElementById("detailedSolution").innerHTML = `<pre>${logText}</pre>`;
}

// -------------------- Вспомогательные функции --------------------
function computeCycles() {
  if (nodes.length === 0 || pipes.length === 0) return [];
  
  // Построение графа
  const graph = {};
  nodes.forEach(n => { graph[n.id] = []; });
  pipes.forEach((pipe, index) => {
    graph[pipe.startNode.id].push({ neighbor: pipe.endNode.id, pipeIndex: index });
    graph[pipe.endNode.id].push({ neighbor: pipe.startNode.id, pipeIndex: index });
  });
  
  // Поиск в глубину для построения остовного дерева
  const visited = {};
  const parent = {};
  const treeEdges = new Set();
  
  function dfs(u) {
    visited[u] = true;
    graph[u].forEach(item => {
      if (!visited[item.neighbor]) {
        parent[item.neighbor] = { parent: u, edge: item.pipeIndex };
        treeEdges.add(item.pipeIndex);
        dfs(item.neighbor);
      }
    });
  }
  
  // Запуск DFS с первого узла
  const startNodeId = nodes[0].id;
  dfs(startNodeId);
  
  // Находим хорды (ребра не в остовном дереве)
  const chords = [];
  pipes.forEach((pipe, index) => {
    if (!treeEdges.has(index)) {
      chords.push(index);
    }
  });
  
  // Функция для построения пути между двумя узлами в дереве
  function getTreePath(u, v) {
    const pathU = [];
    let current = u;
    while (current !== undefined) {
      pathU.push(current);
      current = parent[current] ? parent[current].parent : undefined;
    }
    
    const pathV = [];
    current = v;
    while (current !== undefined) {
      pathV.push(current);
      current = parent[current] ? parent[current].parent : undefined;
    }
    
    // Находим общего предка
    let lca = null;
    for (let node of pathU) {
      if (pathV.includes(node)) {
        lca = node;
        break;
      }
    }
    
    // Строим путь от u до lca
    const pathFromU = [];
    for (let node of pathU) {
      pathFromU.push(node);
      if (node === lca) break;
    }
    
    // Строим путь от v до lca (в обратном порядке)
    const pathFromV = [];
    for (let node of pathV) {
      if (node === lca) break;
      pathFromV.push(node);
    }
    pathFromV.reverse();
    
    return pathFromU.concat(pathFromV);
  }
  
  // Построение уравнений для каждого контура
  const cyclesArr = [];
  chords.forEach(chordIndex => {
    const chord = pipes[chordIndex];
    const u = chord.startNode.id;
    const v = chord.endNode.id;
    
    // Получаем путь по дереву между концами хорды
    const treePath = getTreePath(u, v);
    
    // Добавляем хорду для замыкания цикла
    const fullCycleNodes = treePath.slice();
    fullCycleNodes.push(u);
    
    // Создаем уравнение контура
    const cycleRow = new Array(pipes.length).fill(0);
    
    for (let i = 0; i < fullCycleNodes.length - 1; i++) {
      const a = fullCycleNodes[i];
      const b = fullCycleNodes[i + 1];
      
      // Находим трубу между a и b
      const pipeIdx = pipes.findIndex(p =>
        (p.startNode.id == a && p.endNode.id == b) ||
        (p.startNode.id == b && p.endNode.id == a)
      );
      
      if (pipeIdx !== -1) {
        // Определяем направление (+1 или -1)
        const sign = (pipes[pipeIdx].startNode.id == a && pipes[pipeIdx].endNode.id == b) ? 1 : -1;
        cycleRow[pipeIdx] = sign;
      }
    }
    
    cyclesArr.push(cycleRow);
  });
  
  return cyclesArr;
}

function matrixToString(mat) {
  return mat.map(row => 
    row.map(val => 
      typeof val === 'number' ? val.toFixed(4).padStart(8) : val.padStart(8)
    ).join(' ')
  ).join('\n');
}

function toggleDetailedSolution() {
  const detailedDiv = document.getElementById("detailedSolution");
  const toggleBtn = document.getElementById("toggleDetailedSolutionBtn");
  
  if (detailedDiv.style.display === "none" || detailedDiv.style.display === "") {
    detailedDiv.style.display = "block";
    toggleBtn.textContent = "Скрыть подробное решение";
  } else {
    detailedDiv.style.display = "none";
    toggleBtn.textContent = "Показать подробное решение";
  }
}