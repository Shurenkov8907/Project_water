const canvas = document.getElementById("waterSupplyCanvas");
const ctx = canvas.getContext("2d");

const nodes = [];
const sections = [];
const MAX_ITERATIONS = 100;
const MAX_ALLOWED_DISCREPANCY = 0.5; // м

// Загрузка данных о диаметрах труб
async function loadDiameters() {
  try {
    const response = await fetch("./pipes.json");
    if (!response.ok) throw new Error("Не удалось загрузить pipes.json");

    const data = await response.json();
    const select = document.getElementById("sectionDiameter");
    select.innerHTML = '<option value="">Выберите диаметр</option>';

    data.forEach((item) => {
      const label = item["Обозначение в проекте "].trim();
      const diameterMeters = parseFloat(
        item["Dвн - внутренний диаметр, расчетный м"]
      );
      if (!isNaN(diameterMeters)) {
        const option = document.createElement("option");
        option.value = diameterMeters;
        option.textContent = label;
        select.appendChild(option);
      }
    });
  } catch (error) {
    console.error("Ошибка загрузки данных о диаметрах:", error);
    alert("Не удалось загрузить данные из pipes.json");
  }
}

// Добавление узла
function addNode() {
  const id = parseInt(document.getElementById("nodeId").value);
  const x = parseInt(document.getElementById("nodeX").value);
  const y = parseInt(document.getElementById("nodeY").value);
  const flowRate = parseFloat(document.getElementById("nodeFlowRate").value); // теперь в л/с

  if (isNaN(id) || isNaN(x) || isNaN(y) || isNaN(flowRate)) {
    alert("Введите корректные данные для узла!");
    return;
  }

  if (nodes.some((node) => node.id === id)) {
    alert("Узел с таким ID уже существует!");
    return;
  }

  // Сохраняем расход в л/с, 
  nodes.push({ id, x, y, flowRate });
  drawNetwork();
  document.getElementById("nodeForm").reset();
}


// Добавление участка
function addSection() {
  const id = parseInt(document.getElementById("sectionId").value);
  const startNode = parseInt(document.getElementById("startNode").value);
  const endNode = parseInt(document.getElementById("endNode").value);
  const material = document.getElementById("sectionMaterial").value;
  const diameter = parseFloat(document.getElementById("sectionDiameter").value);

  if (
    isNaN(id) ||
    isNaN(startNode) ||
    isNaN(endNode) ||
    isNaN(diameter) ||
    !material
  ) {
    alert("Введите корректные данные для участка!");
    return;
  }

  if (sections.some((section) => section.id === id)) {
    alert("Участок с таким ID уже существует!");
    return;
  }

  if (
    !nodes.some((node) => node.id === startNode) ||
    !nodes.some((node) => node.id === endNode)
  ) {
    alert("Один из узлов не существует!");
    return;
  }

  sections.push({ id, startNode, endNode, material, diameter });
  drawNetwork();
  document.getElementById("sectionForm").reset();
}

// Отрисовка сети
function drawNetwork() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Отрисовка участков остается без изменений
  sections.forEach((section) => {
    const startNode = nodes.find((node) => node.id === section.startNode);
    const endNode = nodes.find((node) => node.id === section.endNode);
    if (!startNode || !endNode) return;

    ctx.beginPath();
    ctx.moveTo(startNode.x, startNode.y);
    ctx.lineTo(endNode.x, endNode.y);
    ctx.strokeStyle = section.material === "steel" ? "green" : "orange";
    ctx.lineWidth = 3;
    ctx.stroke();

    const midX = (startNode.x + endNode.x) / 2;
    const midY = (startNode.y + endNode.y) / 2;

    ctx.font = "12px Arial";
    ctx.fillStyle = "black";
    ctx.fillText(`Участок ${section.id}`, midX, midY - 10);
    ctx.fillText(
      `Длина: ${calculateLength(section).toFixed(2)} м`,
      midX,
      midY + 10
    );

    if (section.flow !== undefined) {
      ctx.fillText(
        `Расход: ${section.flow.toFixed(2)} л/с`,
        midX,
        midY + 25
      );
      drawArrow(startNode, endNode, section.flow);
    }
  });

  // Отрисовка узлов (измененная часть)
  nodes.forEach((node) => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = "blue";
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.stroke();

    ctx.font = "12px Arial";
    ctx.fillStyle = "black";
    ctx.fillText(`Узел ${node.id}`, node.x + 15, node.y - 10);
    ctx.fillText(`Расход: ${node.flowRate} л/с`, node.x + 15, node.y + 10); // Теперь отображаем л/с
  });
}

// Расчет длины участка
function calculateLength(section) {
  const startNode = nodes.find((node) => node.id === section.startNode);
  const endNode = nodes.find((node) => node.id === section.endNode);
  if (!startNode || !endNode) return 0;

  return Math.sqrt(
    Math.pow(endNode.x - startNode.x, 2) + Math.pow(endNode.y - startNode.y, 2)
  );
}

// Отрисовка стрелки направления потока
function drawArrow(startNode, endNode, flow) {
  if (isNaN(flow)) return;

  const fromNode = flow >= 0 ? startNode : endNode;
  const toNode = flow >= 0 ? endNode : startNode;

  const midX = (fromNode.x + toNode.x) / 2;
  const midY = (fromNode.y + toNode.y) / 2;

  const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
  const arrowLength = 15;

  ctx.beginPath();
  ctx.moveTo(midX, midY);
  ctx.lineTo(
    midX - arrowLength * Math.cos(angle - Math.PI / 6),
    midY - arrowLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(midX, midY);
  ctx.lineTo(
    midX - arrowLength * Math.cos(angle + Math.PI / 6),
    midY - arrowLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Расчет скорости потока (в м/с)
function calculateVelocity(diameterMeters, flowRate) {
  if (isNaN(diameterMeters)) return 0;
  if (diameterMeters <= 0) return 0;
  if (isNaN(flowRate)) return 0;

  // flowRate в л/с, переводим в м³/с (делим на 1000)
  const flowRateM3 = flowRate / 1000;
  return (4 * Math.abs(flowRateM3)) / (Math.PI * Math.pow(diameterMeters, 2));
}

// Расчет коэффициента трения
function calculateFrictionFactor(reynolds, diameterMeters, material) {
  if (isNaN(reynolds)) return 0.02;
  if (reynolds === 0) return 0.02;
  if (isNaN(diameterMeters)) return 0.02;

  let lam;
  if (material === "steel") {
    // Формула для стальных труб
    lam =
      (0.0159 / Math.pow(diameterMeters, 0.226)) *
      Math.pow(1.0 + 0.684 / (reynolds * 1.31e-6), 0.226);
  } else {
    // Формула для пластиковых труб
    const Rekv = (500 * diameterMeters) / 0.00014;
    let b = 1 + Math.log10(reynolds) / Math.log10(Rekv);
    b = b > 2 ? 2 : b;
    const logPart = Math.log10((3.7 * diameterMeters) / 0.00014);
    lam = Math.pow(
      (0.5 * (b / 2 + (1.312 * (2 - b) * logPart) / (Math.log10(reynolds) - 1)) /
        logPart,
      2
    ));
  }

  return lam;
}

// Расчет потерь напора (в метрах)
function calculateHeadLoss(diameterMeters, length, flowRate, material) {
  if (isNaN(diameterMeters)) return 0;
  if (isNaN(length)) return 0;
  if (isNaN(flowRate)) return 0;
  
  const velocity = calculateVelocity(diameterMeters, flowRate);
  const reynolds = (velocity * diameterMeters) / 1.31e-6;
  const lam = calculateFrictionFactor(reynolds, diameterMeters, material);
  
  const g = 9.81;
  return ((lam * velocity * velocity) / (2 * g)) * (length / diameterMeters);
}

// Расчет всех потерь напора
function calculateAllHeadLosses() {
  sections.forEach((section) => {
    if (isNaN(section.flow)) {
      section.headLoss = 0;
      return;
    }

    const diameterMeters = section.diameter;
    const length = calculateLength(section);
    const flowRate = Math.abs(section.flow);
    const material = section.material;

    section.headLoss = calculateHeadLoss(
      diameterMeters,
      length,
      flowRate,
      material
    );

    // Дополнительные параметры для отладки
    const velocity = calculateVelocity(diameterMeters, flowRate);
    const reynolds = (velocity * diameterMeters) / 1.31e-6;
    section.velocity = velocity;
    section.reynolds = reynolds;
    section.frictionFactor = calculateFrictionFactor(reynolds, diameterMeters, material);
  });
}

// Построение матрицы инцидентности
function computeIncidenceMatrix() {
  if (nodes.length === 0 || sections.length === 0) {
    alert("Сначала добавьте узлы и участки!");
    return;
  }

  const nodeIds = nodes.map((node) => node.id).sort((a, b) => a - b);
  const sectionIds = sections
    .map((section) => section.id)
    .sort((a, b) => a - b);

  const matrix = nodeIds.map((nodeId) => {
    return sectionIds.map((sectionId) => {
      const section = sections.find((s) => s.id === sectionId);
      if (section.startNode === nodeId) return -1;
      if (section.endNode === nodeId) return 1;
      return 0;
    });
  });

  displayMatrix(matrix, nodeIds, sectionIds);
}

// Отображение матрицы инцидентности
function displayMatrix(matrix, nodeIds, sectionIds) {
  const container = document.getElementById("matrixOutput");
  if (!container) return;

  const table = document.createElement("table");
  table.border = "1";
  table.style.borderCollapse = "collapse";
  table.style.margin = "20px auto";

  const headerRow = document.createElement("tr");
  headerRow.appendChild(document.createElement("th"));
  sectionIds.forEach((id) => {
    const th = document.createElement("th");
    th.textContent = `Уч. ${id}`;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  nodeIds.forEach((nodeId, rowIndex) => {
    const row = document.createElement("tr");
    const nodeHeader = document.createElement("th");
    nodeHeader.textContent = `Узел ${nodeId}`;
    row.appendChild(nodeHeader);

    matrix[rowIndex].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      cell.style.textAlign = "center";
      cell.style.padding = "5px 10px";
      row.appendChild(cell);
    });

    table.appendChild(row);
  });

  container.innerHTML = "<h3>Матрица инцидентности:</h3>";
  container.appendChild(table);
}

// Решение матрицы инцидентности
function solveIncidenceMatrix() {
  if (nodes.length === 0 || sections.length === 0) {
    alert("Сначала добавьте узлы и участки!");
    return;
  }

  const A = [];
  const b = [];

  const nodeIds = nodes.map((node) => node.id).sort((a, b) => a - b);
  const sectionIds = sections
    .map((section) => section.id)
    .sort((a, b) => a - b);

  // Исключаем последний узел (опорный)
  nodeIds.slice(0, -1).forEach((nodeId) => {
    const row = [];
    sectionIds.forEach((sectionId) => {
      const section = sections.find((s) => s.id === sectionId);
      if (section.startNode === nodeId) row.push(-1);
      else if (section.endNode === nodeId) row.push(1);
      else row.push(0);
    });

    A.push(row);
    const node = nodes.find((n) => n.id === nodeId);
    // Уже работаем с л/с, переводим в м³/с (делим на 1000)
    b.push(node.flowRate / 1000);
  });

  const x = gaussSolve(A, b);
  if (!x) {
    alert("Система не имеет решений или вырождена.");
    return;
  }

  sectionIds.forEach((id, index) => {
    const section = sections.find((s) => s.id === id);
    if (section) {
      section.flow = x[index] * 1000; // Остается в л/с
    }
  });

  renderSolutionTable(sectionIds, x);
  drawNetwork();
}

// Решение системы линейных уравнений методом Гаусса
function gaussSolve(A, b) {
  const n = A.length;
  if (n === 0) return null;
  const m = A[0].length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < Math.min(n, m); i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];

    if (Math.abs(M[i][i]) < 1e-12) continue;

    const div = M[i][i];
    for (let j = i; j <= m; j++) {
      M[i][j] /= div;
    }

    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = M[k][i];
      for (let j = i; j <= m; j++) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  for (let i = 0; i < n; i++) {
    let allZero = true;
    for (let j = 0; j < m; j++) {
      if (Math.abs(M[i][j]) > 1e-12) {
        allZero = false;
        break;
      }
    }
    if (allZero && Math.abs(M[i][m]) > 1e-12) {
      return null;
    }
  }

  const x = new Array(m).fill(0);
  for (let i = 0; i < Math.min(n, m); i++) {
    x[i] = M[i][m];
  }

  return x;
}

// Отображение решения матрицы
function renderSolutionTable(sectionIds, x) {
  const container = document.getElementById("solutionTableContainer");
  if (!container) return;

  const table = document.createElement("table");
  table.border = "1";
  table.style.borderCollapse = "collapse";
  table.style.margin = "20px auto";

  table.innerHTML = `
    <thead>
      <tr>
        <th>Участок</th>
        <th>Расход (л/с)</th>
        <th>Расход (м³/ч)</th>
      </tr>
    </thead>
    <tbody>
      ${sectionIds
        .map(
          (id, i) => `
          <tr>
            <td>${id}</td>
            <td>${
              isNaN(x[i])
                ? '<span class="na-value">N/A</span>'
                : (x[i] * 1000).toFixed(2)
            }</td>
            <td>${
              isNaN(x[i])
                ? '<span class="na-value">N/A</span>'
                : (x[i] * 3600).toFixed(2)
            }</td>
          </tr>
        `
        )
        .join("")}
    </tbody>
  `;

  container.innerHTML = "<h3>Результаты решения (метод Гаусса):</h3>";
  container.appendChild(table);
}

// Построение списка смежности
function buildAdjacencyList() {
  const adjacency = new Map();
  nodes.forEach((node) => adjacency.set(node.id, []));

  sections.forEach((section) => {
    adjacency.get(section.startNode).push(section.endNode);
    adjacency.get(section.endNode).push(section.startNode);
  });

  return adjacency;
}

// Поиск циклов в графе
function findCycles(adjacency) {
  const cycles = [];
  const visited = new Set();

  function dfs(current, parent, path) {
    visited.add(current);
    path.push(current);

    for (const neighbor of adjacency.get(current)) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, current, path);
      } else if (neighbor !== parent && path.includes(neighbor)) {
        const cycleStartIndex = path.indexOf(neighbor);
        const cycle = path.slice(cycleStartIndex);
        const sortedCycle = [...new Set(cycle)].sort((a, b) => a - b).join("-");
        if (!cycles.some((c) => c.join("-") === sortedCycle)) {
          cycles.push(cycle);
        }
      }
    }

    path.pop();
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node, null, []);
    }
  }

  return cycles;
}

// Поиск циклов с направлениями участков
function findCyclesWithDirections() {
  const adjacency = buildAdjacencyList();
  const cycles = findCycles(adjacency);
  const cyclesWithDirections = [];

  cycles.forEach((cycle) => {
    const directedCycle = [];
    for (let i = 0; i < cycle.length; i++) {
      const node1 = cycle[i];
      const node2 = cycle[(i + 1) % cycle.length];
      const section = sections.find(
        (sec) =>
          (sec.startNode === node1 && sec.endNode === node2) ||
          (sec.startNode === node2 && sec.endNode === node1)
      );

      if (section) {
        const direction = section.startNode === node1 ? 1 : -1;
        directedCycle.push({
          sectionId: section.id,
          direction: direction,
          section: section,
        });
      }
    }
    cyclesWithDirections.push(directedCycle);
  });

  return cyclesWithDirections;
}

// Расчет невязок по кольцам
function calculateHeadLossDiscrepancy(cyclesWithDirections) {
  const discrepancies = [];

  cyclesWithDirections.forEach((cycle) => {
    let sumHeadLoss = 0;
    let hasValidSections = false;

    cycle.forEach((link) => {
      const section = sections.find((s) => s.id === link.sectionId);
      if (!section || section.headLoss === undefined || isNaN(section.headLoss)) {
        console.warn(
          `Не найдены данные о потерях напора для участка ${link.sectionId}`
        );
        return;
      }

      sumHeadLoss += section.headLoss * link.direction;
      hasValidSections = true;
    });

    if (hasValidSections) {
      discrepancies.push(sumHeadLoss);
    } else {
      console.warn("Кольцо не содержит участков с валидными данными");
      discrepancies.push(NaN);
    }
  });

  return discrepancies;
}

// Коррекция расходов для балансировки
function correctFlows(cyclesWithDirections, discrepancies) {
  let correctionsApplied = false;

  cyclesWithDirections.forEach((cycle, cycleIndex) => {
    const discrepancy = discrepancies[cycleIndex];
    if (isNaN(discrepancy) || Math.abs(discrepancy) <= MAX_ALLOWED_DISCREPANCY)
      return;

    let sumHQ = 0;
    cycle.forEach((link) => {
      const section = sections.find((s) => s.id === link.sectionId);
      if (!section || isNaN(section.flow) || isNaN(section.headLoss)) return;

      const q = Math.abs(section.flow);
      sumHQ += section.headLoss / q;
    });

    if (sumHQ === 0) return;

    const deltaQ = -discrepancy / (2 * sumHQ);

    cycle.forEach((link) => {
      const section = sections.find((s) => s.id === link.sectionId);
      if (!section || isNaN(section.flow)) return;

      section.flow += deltaQ * link.direction;
      correctionsApplied = true;
    });
  });

  return correctionsApplied;
}

// Выполнение гидравлического расчета
function performHydraulicCalculation() {
  // 1. Решение методом Гаусса
  solveIncidenceMatrix();
  
  // 2. Расчет начальных потерь напора
  calculateAllHeadLosses();
  
  // 3. Нахождение контуров
  const cyclesWithDirections = findCyclesWithDirections();
  
  // 4. Расчет невязок
  const discrepancies = calculateHeadLossDiscrepancy(cyclesWithDirections);
  
  // 5. Коррекция расходов
  let iteration = 0;
  let maxDiscrepancy = Math.max(...discrepancies.map(Math.abs));
  
  while (maxDiscrepancy > MAX_ALLOWED_DISCREPANCY && iteration < MAX_ITERATIONS) {
    const correctionsApplied = correctFlows(cyclesWithDirections, discrepancies);
    if (!correctionsApplied) break;
    
    calculateAllHeadLosses();
    const newDiscrepancies = calculateHeadLossDiscrepancy(cyclesWithDirections);
    maxDiscrepancy = Math.max(...newDiscrepancies.map(Math.abs));
    iteration++;
  }
  
  // 6. Отображение результатов
  renderFinalResults(cyclesWithDirections, discrepancies, iteration);
}

// Отображение финальных результатов
function renderFinalResults(cyclesWithDirections, discrepancies, iterations) {
  const container = document.getElementById("finalResults");
  container.innerHTML = `
    <h2 class="result-title">Результаты гидравлического расчета</h2>
    <div class="result-section">
      <h3>Невязки напора по кольцам</h3>
      <table>
        <thead>
          <tr>
            <th>Кольцо</th>
            <th>Состав кольца</th>
            <th>Невязка (м)</th>
            <th>Допустимая невязка</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          ${cyclesWithDirections
            .map((cycle, i) => {
              const discrepancy = isNaN(discrepancies[i]) ? 0 : discrepancies[i];
              const isOk = Math.abs(discrepancy) <= MAX_ALLOWED_DISCREPANCY;

              const cycleDesc = cycle
                .map((link) => {
                  const section = sections.find((s) => s.id === link.sectionId);
                  const directionSymbol = link.direction > 0 ? "→" : "←";
                  return `${section.id}${directionSymbol}`;
                })
                .join(" ");

              return `
                <tr>
                  <td>${i + 1}</td>
                  <td>${cycleDesc}</td>
                  <td>${discrepancy.toFixed(4)}</td>
                  <td>${MAX_ALLOWED_DISCREPANCY.toFixed(2)}</td>
                  <td class="${isOk ? "ok-status" : "error-status"}">
                    ${isOk ? "✓ OK" : "✗ Превышена"}
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    
    <div class="result-section">
      <h3>Параметры участков</h3>
      <table>
        <thead>
          <tr>
            <th>Участок</th>
            <th>Расход (л/с)</th>
            <th>Потери напора (м)</th>
            <th>Скорость (м/с)</th>
            <th>Направление</th>
          </tr>
        </thead>
        <tbody>
          ${sections
            .map((section) => {
              const direction = section.flow >= 0 ? "→" : "←";
              return `
                <tr>
                  <td>${section.id}</td>
                  <td>${section.flow.toFixed(2)}</td>
                  <td>${
                    isNaN(section.headLoss)
                      ? '<span class="na-value">N/A</span>'
                      : section.headLoss.toFixed(3)
                  }</td>
                  <td>${
                    isNaN(section.velocity)
                      ? '<span class="na-value">N/A</span>'
                      : section.velocity.toFixed(3)
                  }</td>
                  <td>${direction}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    
    <div class="iteration-info">
      <p>Количество итераций: ${iterations}</p>
      <p>Максимальная невязка: ${Math.max(...discrepancies.map(Math.abs)).toFixed(4)} м</p>
    </div>
  `;
}

// Инициализация при загрузке страницы
window.onload = () => {
  loadDiameters();
  drawNetwork();
};