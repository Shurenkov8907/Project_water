const canvas = document.getElementById("waterSupplyCanvas");
const ctx = canvas.getContext("2d");

const nodes = [];
const sections = [];
const MAX_ITERATIONS = 100;
const MAX_ALLOWED_DISCREPANCY = 0.5; // м

async function loadDiameters() {
  try {
    const response = await fetch("./pipes.json");
    if (!response.ok) throw new Error("Не удалось загрузить pipes.json");

    const data = await response.json();
    const select = document.getElementById("sectionDiameter");
    select.innerHTML = "";

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

function clearForm() {
  const nodeForm = document.getElementById("nodeForm");
  const sectionForm = document.getElementById("sectionForm");

  if (nodeForm) nodeForm.reset();
  if (sectionForm) sectionForm.reset();

  ["velocity", "head-loss", "reynolds", "section-length"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerText = "";
  });

  localStorage.removeItem("hydraulicResults");
}

function calculateVelocity(diameterMeters, flowRate) {
  return (4 * flowRate) / (Math.PI * Math.pow(diameterMeters, 2));
}

function calculateFrictionFactor(reynolds, diameterMeters, roughness) {
  if (reynolds === 0) return 0.02;

  let lambda = 0.02;
  for (let i = 0; i < 100; i++) {
    const denominator = reynolds * Math.sqrt(lambda);
    const temp =
      -2 * Math.log10(roughness / (3.7 * diameterMeters) + 2.51 / denominator);
    lambda = 1 / Math.pow(temp, 2);
  }
  return lambda;
}

function calculateHeadLoss(diameterMeters, length, flowRate, lambda) {
  const velocity = calculateVelocity(diameterMeters, flowRate);
  const g = 9.81;
  return ((lambda * velocity * velocity) / (2 * g)) * (length / diameterMeters);
}

function calculateLength(section) {
  const startNode = nodes.find((node) => node.id === section.startNode);
  const endNode = nodes.find((node) => node.id === section.endNode);

  if (!startNode || !endNode) return 0;

  return Math.sqrt(
    Math.pow(endNode.x - startNode.x, 2) + Math.pow(endNode.y - startNode.y, 2)
  );
}

function calculate() {
  const flowRateInput = document.getElementById("sectionFlowRate");
  const materialInput = document.getElementById("sectionMaterial");
  const sectionIdInput = document.getElementById("sectionId");

  if (!flowRateInput || !materialInput || !sectionIdInput) {
    alert("Отсутствуют необходимые элементы формы!");
    return;
  }

  const flowRate = parseFloat(flowRateInput.value) / 1000; // м³/с
  const material = materialInput.value;
  const sectionId = parseInt(sectionIdInput.value);

  const section = sections.find((sec) => sec.id === sectionId);

  if (!section) {
    alert("Указанный участок не найден!");
    return;
  }

  const diameterMeters = section.diameter;
  const length = calculateLength(section);

  if (
    isNaN(diameterMeters) ||
    diameterMeters < 0.01 ||
    diameterMeters > 2 ||
    isNaN(length) ||
    length <= 0 ||
    isNaN(flowRate) ||
    flowRate <= 0
  ) {
    alert("Введите корректные данные!");
    return;
  }

  const viscosity = 1.31e-6;
  const velocity = calculateVelocity(diameterMeters, flowRate);
  const reynolds = (velocity * diameterMeters) / viscosity;

  let roughness;
  switch (material.toLowerCase()) {
    case "steel":
      roughness = 0.00015;
      break;
    case "polyethylene":
      roughness = 0.0000015;
      break;
    default:
      alert("Некорректный материал!");
      return;
  }

  const lambda = calculateFrictionFactor(reynolds, diameterMeters, roughness);
  const headLoss = calculateHeadLoss(diameterMeters, length, flowRate, lambda);

  document.getElementById("velocity").innerText = velocity.toFixed(2);
  document.getElementById("head-loss").innerText = headLoss.toFixed(2);
  document.getElementById("reynolds").innerText = reynolds.toFixed(0);
  document.getElementById("section-length").innerText = length.toFixed(2);

  saveResults(velocity, headLoss, reynolds, length);
}

function saveResults(velocity, headLoss, reynolds, length) {
  const results = { velocity, headLoss, reynolds, length };
  localStorage.setItem("hydraulicResults", JSON.stringify(results));
  alert("Результаты сохранены!");
}

function loadResults() {
  const savedResults = localStorage.getItem("hydraulicResults");
  if (savedResults) {
    try {
      const results = JSON.parse(savedResults);
      document.getElementById("velocity").innerText =
        results.velocity.toFixed(2);
      document.getElementById("head-loss").innerText =
        results.headLoss.toFixed(2);
      document.getElementById("reynolds").innerText =
        results.reynolds.toFixed(0);
      document.getElementById("section-length").innerText =
        results.length.toFixed(2);
    } catch (e) {
      console.warn("Ошибка при загрузке сохранённых результатов:", e);
    }
  }
}

function addNode() {
  const id = parseInt(document.getElementById("nodeId").value);
  const x = parseInt(document.getElementById("nodeX").value);
  const y = parseInt(document.getElementById("nodeY").value);
  const flowRate = parseFloat(document.getElementById("nodeFlowRate").value);

  if (isNaN(id) || isNaN(x) || isNaN(y) || isNaN(flowRate)) {
    alert("Введите корректные данные для узла!");
    return;
  }

  if (nodes.some((node) => node.id === id)) {
    alert("Узел с таким ID уже существует!");
    return;
  }

  nodes.push({ id, x, y, flowRate });
  drawNetwork();
}

function addSection() {
  const id = parseInt(document.getElementById("sectionId").value);
  const startNode = parseInt(document.getElementById("startNode").value);
  const endNode = parseInt(document.getElementById("endNode").value);
  const material = document.getElementById("sectionMaterial").value;
  const diameter = parseFloat(document.getElementById("sectionDiameter").value);

  if (isNaN(id) || isNaN(startNode) || isNaN(endNode) || isNaN(diameter)) {
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
}

function drawNode(node) {
  ctx.beginPath();
  ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI);
  ctx.fillStyle = "blue";
  ctx.fill();
  ctx.strokeStyle = "black";
  ctx.stroke();

  ctx.font = "12px Arial";
  ctx.fillStyle = "black";
  ctx.fillText(`Узел ${node.id}`, node.x + 15, node.y - 10);
  ctx.fillText(`Расход: ${node.flowRate} м³/ч`, node.x + 15, node.y + 10);
}

function drawSection(section) {
  const startNode = nodes.find((node) => node.id === section.startNode);
  const endNode = nodes.find((node) => node.id === section.endNode);
  if (!startNode || !endNode) return;

  const length = calculateLength(section);

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
  ctx.fillText(`Длина: ${length.toFixed(2)} м`, midX, midY + 10);
  ctx.fillText(`Материал: ${section.material}`, midX, midY + 25);
  ctx.fillText(`Диаметр: ${(section.diameter * 1000).toFixed(0)} мм`, midX, midY + 40);
  
  if (section.flow !== undefined) {
    ctx.fillText(`Расход: ${(section.flow * 3600).toFixed(2)} м³/ч`, midX, midY + 55);
    drawArrow(startNode, endNode, section.flow);
  }
}

function drawArrow(startNode, endNode, flow) {
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

function drawNetwork() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  sections.forEach(drawSection);
  nodes.forEach(drawNode);
}

function computeIncidenceMatrix() {
  if (nodes.length === 0 || sections.length === 0) {
    alert("Сначала добавьте узлы и участки!");
    return;
  }

  const nodeIds = nodes.map(node => node.id).sort((a, b) => a - b);
  const sectionIds = sections.map(section => section.id).sort((a, b) => a - b);

  const matrix = nodeIds.map(nodeId => {
    return sectionIds.map(sectionId => {
      const section = sections.find(s => s.id === sectionId);
      if (section.startNode === nodeId) return -1;
      if (section.endNode === nodeId) return 1;
      return 0;
    });
  });

  displayMatrix(matrix, nodeIds, sectionIds);
}

function displayMatrix(matrix, nodeIds, sectionIds) {
  const container = document.getElementById("matrixOutput");
  if (!container) return;

  const table = document.createElement("table");
  table.border = "1";
  table.style.borderCollapse = "collapse";
  table.style.margin = "20px auto";

  const headerRow = document.createElement("tr");
  headerRow.appendChild(document.createElement("th"));
  sectionIds.forEach(id => {
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

    matrix[rowIndex].forEach(value => {
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

function solveIncidenceMatrix() {
  if (nodes.length === 0 || sections.length === 0) {
    alert("Сначала добавьте узлы и участки!");
    return;
  }

  const A = [];
  const b = [];

  const nodeIds = nodes.map(node => node.id).sort((a, b) => a - b);
  const sectionIds = sections.map(section => section.id).sort((a, b) => a - b);

  nodeIds.slice(0, -1).forEach(nodeId => {
    const row = [];
    sectionIds.forEach(sectionId => {
      const section = sections.find(s => s.id === sectionId);
      if (section.startNode === nodeId) row.push(-1);
      else if (section.endNode === nodeId) row.push(1);
      else row.push(0);
    });

    A.push(row);
    const node = nodes.find(n => n.id === nodeId);
    b.push(node.flowRate / 3600);
  });

  const x = gaussSolve(A, b);
  if (!x) {
    alert("Система не имеет решений или вырождена.");
    return;
  }

  sectionIds.forEach((id, index) => {
    const section = sections.find(s => s.id === id);
    if (section) {
      section.flow = x[index];
    }
  });

  renderSolutionTable(sectionIds, x);
  drawNetwork();
}

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
        <th>Расход (м³/с)</th>
        <th>Расход (м³/ч)</th>
      </tr>
    </thead>
    <tbody>
      ${sectionIds.map((id, i) => `
        <tr>
          <td>${id}</td>
          <td>${x[i].toFixed(6)}</td>
          <td>${(x[i] * 3600).toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  `;

  container.innerHTML = "<h3>Результаты решения (метод Гаусса):</h3>";
  container.appendChild(table);
}

function buildAdjacencyList(nodes, sections) {
  const adjacency = new Map();
  nodes.forEach((node) => adjacency.set(node.id, []));

  sections.forEach((section) => {
    adjacency.get(section.startNode).push(section.endNode);
    adjacency.get(section.endNode).push(section.startNode);
  });

  return adjacency;
}

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

function findCyclesWithDirections() {
  const adjacency = buildAdjacencyList(nodes, sections);
  const cycles = findCycles(adjacency);
  const cyclesWithDirections = [];

  cycles.forEach(cycle => {
    const directedCycle = [];
    for (let i = 0; i < cycle.length; i++) {
      const node1 = cycle[i];
      const node2 = cycle[(i + 1) % cycle.length];
      const section = sections.find(sec => 
        (sec.startNode === node1 && sec.endNode === node2) || 
        (sec.startNode === node2 && sec.endNode === node1)
      );
      
      if (section) {
        const direction = section.startNode === node1 ? 1 : -1;
        directedCycle.push({
          sectionId: section.id,
          direction: direction
        });
      }
    }
    cyclesWithDirections.push(directedCycle);
  });

  return cyclesWithDirections;
}

function calculateHeadLossDiscrepancy(cyclesWithDirections) {
  const discrepancies = [];
  
  cyclesWithDirections.forEach(cycle => {
    let sumHeadLoss = 0;
    
    cycle.forEach(link => {
      const section = sections.find(s => s.id === link.sectionId);
      if (!section || section.headLoss === undefined) return;
      
      sumHeadLoss += section.headLoss * link.direction;
    });
    
    discrepancies.push(sumHeadLoss);
  });
  
  return discrepancies;
}

function correctFlows(cyclesWithDirections, discrepancies) {
  let correctionsApplied = false;
  
  cyclesWithDirections.forEach((cycle, cycleIndex) => {
    const discrepancy = discrepancies[cycleIndex];
    if (Math.abs(discrepancy) <= MAX_ALLOWED_DISCREPANCY) return;
    
    let sumHQ = 0;
    cycle.forEach(link => {
      const section = sections.find(s => s.id === link.sectionId);
      if (!section || section.flow === undefined || section.headLoss === undefined) return;
      
      const q = Math.abs(section.flow);
      sumHQ += section.headLoss / q;
    });
    
    if (sumHQ === 0) return;
    
    const deltaQ = -discrepancy / (2 * sumHQ);
    
    cycle.forEach(link => {
      const section = sections.find(s => s.id === link.sectionId);
      if (!section || section.flow === undefined) return;
      
      section.flow += deltaQ * link.direction;
      correctionsApplied = true;
    });
  });
  
  return correctionsApplied;
}

function calculateAllHeadLosses() {
  sections.forEach(section => {
    if (section.flow === undefined) return;
    
    const diameterMeters = section.diameter;
    const length = calculateLength(section);
    const material = section.material;
    const flowRate = Math.abs(section.flow);
    
    const viscosity = 1.31e-6;
    const velocity = calculateVelocity(diameterMeters, flowRate);
    const reynolds = (velocity * diameterMeters) / viscosity;

    let roughness;
    switch (material.toLowerCase()) {
      case "steel": roughness = 0.00015; break;
      case "polyethylene": roughness = 0.0000015; break;
      default: roughness = 0.00015;
    }

    const lambda = calculateFrictionFactor(reynolds, diameterMeters, roughness);
    section.headLoss = calculateHeadLoss(diameterMeters, length, flowRate, lambda);
  });
}

function performHydraulicCalculation() {
  // 1. Solve initial flow distribution
  solveIncidenceMatrix();
  
  // 2. Calculate initial head losses
  calculateAllHeadLosses();
  
  // 3. Find cycles with directions
  const cyclesWithDirections = findCyclesWithDirections();
  
  // 4. Iterative balancing process
  let iteration = 0;
  let discrepancies = [];
  let correctionsApplied = false;
  
  do {
    iteration++;
    
    // Calculate discrepancies
    discrepancies = calculateHeadLossDiscrepancy(cyclesWithDirections);
    
    // Apply corrections if needed
    correctionsApplied = correctFlows(cyclesWithDirections, discrepancies);
    
    if (!correctionsApplied) break;
    
    // Recalculate head losses with new flows
    calculateAllHeadLosses();
    
  } while (iteration < MAX_ITERATIONS && discrepancies.some(d => Math.abs(d) > MAX_ALLOWED_DISCREPANCY));
  
  // Display final results
  renderFinalResults(cyclesWithDirections, discrepancies, iteration);
  drawNetwork();
}

function renderFinalResults(cyclesWithDirections, discrepancies, iterations) {
  const container = document.getElementById("finalResults");
  if (!container) return;
  
  let html = `<h3>Результаты гидравлического расчета (итераций: ${iterations}):</h3>`;
  
  // Sections table
  html += `<table border="1" style="border-collapse: collapse; margin: 10px auto;">
    <thead>
      <tr>
        <th>Участок</th>
        <th>Расход (м³/ч)</th>
        <th>Потери напора (м)</th>
      </tr>
    </thead>
    <tbody>
      ${sections.map(section => `
        <tr>
          <td>${section.id}</td>
          <td>${section.flow !== undefined ? (section.flow * 3600).toFixed(2) : "N/A"}</td>
          <td>${section.headLoss !== undefined ? section.headLoss.toFixed(3) : "N/A"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>`;
  
  // Discrepancies table
  html += `<h4>Невязки напора по кольцам:</h4>
  <table border="1" style="border-collapse: collapse; margin: 10px auto;">
    <thead>
      <tr>
        <th>Кольцо</th>
        <th>Невязка (м)</th>
        <th>Статус</th>
      </tr>
    </thead>
    <tbody>
      ${discrepancies.map((d, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${d.toFixed(3)}</td>
          <td>${Math.abs(d) <= MAX_ALLOWED_DISCREPANCY ? "✓ OK" : "✗ Превышено"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>`;
  
  container.innerHTML = html;
}

function addHydraulicCalculationButton() {
  const button = document.createElement("button");
  button.textContent = "Выполнить гидравлический расчет";
  button.onclick = performHydraulicCalculation;
  button.style.margin = "10px";
  button.style.padding = "8px 16px";
  
  const container = document.getElementById("controls");
  if (container) {
    container.appendChild(button);
  }
  
  const resultsDiv = document.createElement("div");
  resultsDiv.id = "finalResults";
  document.body.appendChild(resultsDiv);
}

window.onload = () => {
  loadDiameters();
  loadResults();
  drawNetwork();
  addHydraulicCalculationButton();
};