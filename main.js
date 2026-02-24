
/* ------------------------------------------------------------------ ------------------------------------------------------------------ */
const partPos = { top: [3, 3], bottom: [0, 3], glove: [3, 0], shoes: [0, 0] };
const boardsEl = document.getElementById("boards");
const initialParts = ["top", "bottom", "glove", "shoes"];
let savedData = JSON.parse(localStorage.getItem("circuitBoards") || "null") || null;
let selectedColor = "red";
const size = 4;
let undoStack = [];
let redoStack = [];

const connections = {
  "┃": { l: 0, r: 0, u: 1, d: 1 },
  "━": { l: 1, r: 1, u: 0, d: 0 },
  "┗": { l: 0, r: 1, u: 1, d: 0 },
  "┏": { l: 0, r: 1, u: 0, d: 1 },
  "┓": { l: 1, r: 0, u: 0, d: 1 },
  "┛": { l: 1, r: 0, u: 1, d: 0 },
  "┳": { l: 1, r: 1, u: 0, d: 1 },
  "┻": { l: 1, r: 1, u: 1, d: 0 },
  "┣": { l: 0, r: 1, u: 1, d: 1 },
  "┫": { l: 1, r: 0, u: 1, d: 1 }
};


/* ------------------------------------------------------------------かいろ------------------------------------------------------------------ */
const paletteData = [
  { title: "増幅回路", symbols: ["┃", "━"], multi: false },
  { title: "増幅回路", symbols: ["┗", "┏", "┓", "┛"], multi: false, hideTitle: true },
  { title: "増幅回路", symbols: ["┳", "┫", "┻", "┣"], multi: false, hideTitle: true },
  { title: "複製回路", symbols: ["┳", "┫", "┻", "┣"], multi: true }
];

const templates = [
  {grid:[["┏","┓","┏","┓"],["┃","┗","┛","┃"],["┃","┏","┓","┃"],["┗","┛","┗","┛"]]},
  {grid:[["┏","━","━","┓"],["┗","┓","┏","┛"],["┏","┛","┗","┓"],["┗","━","━","┛"]]},
  {grid:[["┏","┳","┳","┓"],["┣","┫","┣","┫"],["┣","┫","┣","┫"],["┗","┻","┻","┛"]]},
  {grid:[["┏","┳","┳","┓"],["┣","┻","┻","┫"],["┣","┳","┳","┫"],["┗","┻","┻","┛"]]},

  {grid:[["┏","━","━","┓"],["┃","　","　","┃"],["┃","　","　","┃"],["┗","━","━","┛"]]},
  {grid:[["┏","┳","┳","┓"],["┣","┛","┗","┫"],["┣","┓","┏","┫"],["┗","┻","┻","┛"]]},
  {grid:[["┏","┳","┳","┓"],["┃","┃","┃","┃"],["┃","┃","┃","┃"],["┗","┻","┻","┛"]]},
  {grid:[["┏","━","━","┓"],["┣","━","━","┫"],["┣","━","━","┫"],["┗","━","━","┛"]]},

  {grid:[["┏","┓","┏","┓"],["┃","┃","┃","┃"],["┃","┗","┛","┃"],["┗","━","━","┛"]]},
  {grid:[["┏","━","━","┓"],["┃","┏","┓","┃"],["┃","┃","┃","┃"],["┗","┛","┗","┛"]]},
  {grid:[["┏","━","━","┓"],["┗","━","┓","┃"],["┏","━","┛","┃"],["┗","━","━","┛"]]},
  {grid:[["┏","━","━","┓"],["┃","┏","━","┛"],["┃","┗","━","┓"],["┗","━","━","┛"]]},
];

const TEMPLATES_PER_PAGE = 4;
let currentTemplatePage = 0;
const paletteEl = document.getElementById("palette");
const templateBtnContainer = document.getElementById("templateButtons");

const colorGroup = document.createElement("div");
colorGroup.className = "palette-group";

const colorTitle = document.createElement("div");
colorTitle.className = "multi-title";
colorTitle.textContent = "回路色";
colorGroup.appendChild(colorTitle);
paletteEl.appendChild(colorGroup);

paletteData.forEach(group => {
  const div = document.createElement("div");
  div.className = "palette-group";
  const titleDiv = document.createElement("div");
  titleDiv.className = "multi-title";
  if (group.hideTitle) titleDiv.style.visibility = "hidden";
  titleDiv.textContent = group.title;
  div.appendChild(titleDiv);
  group.symbols.forEach(sym => {
    const s = document.createElement("div");
    s.className = "symbol";
    if (group.multi) s.classList.add("multi");
    s.textContent = sym;
    div.appendChild(s);
  });
  paletteEl.appendChild(div);
});

function createTemplateLabel(grid) {
  return '<pre style="margin:0; font-size:12px; line-height:12px;">' +
         grid.map(row => row.join('')).join('\n') +
         '</pre>';
}

function renderTemplatePage() {
  templateBtnContainer.innerHTML = "";
  const start = currentTemplatePage * TEMPLATES_PER_PAGE;
  const end = start + TEMPLATES_PER_PAGE;
  const pageTemplates = templates.slice(start, end);
  pageTemplates.forEach(tpl => {
    const btn = document.createElement("div");
    btn.className = "template-btn";
    btn.innerHTML = createTemplateLabel(tpl.grid);
    btn.onclick = () => {
      selectButton(btn, "template", tpl);
      updateSelectedSymbolColor();
    };
    templateBtnContainer.appendChild(btn);
  });
  const totalPages = Math.ceil(templates.length / TEMPLATES_PER_PAGE);
  document.getElementById("templatePageLabel").textContent =
    (currentTemplatePage + 1) + " / " + totalPages;
  updateSelectedSymbolColor();
  addButtonAnimations();
}


/* ------------------------------------------------------------------せんたく------------------------------------------------------------------ */
const selectState = {
  type: null,
  value: null,
  isMulti: false,
  editMode: 0
};

function clearAllSelections() {
  document.querySelectorAll(".symbol, .template-btn")
    .forEach(b => b.classList.remove("selected"));
  const changeBtn = document.querySelector(".num-edit-btn");
  if (changeBtn) {
    changeBtn.textContent = "変更";
  }
  selectState.type = null;
  selectState.value = null;
  selectState.isMulti = false;
  selectState.editMode = 0;
}

function selectButton(el, type, value = null, isMulti = false) {
  const alreadySelected = el.classList.contains("selected");
  clearAllSelections();
  if (alreadySelected) return;
  el.classList.add("selected");
  selectState.type = type;
  selectState.value = value;
  selectState.isMulti = isMulti;
  updateSelectedSymbolColor();
  updateColorButtonsActive();
}

function animateButton(btn) {
  btn.style.transition = "0.1s all";
  btn.style.transform = "scale(0.9)";
  setTimeout(() => {
    btn.style.transform = "scale(1)";
    btn.style.boxShadow = "";
  }, 100);
}

function addButtonAnimations() {
  const clickableSelectors = [".symbol",".color-btn",".template-btn"];
  const elements = document.querySelectorAll(clickableSelectors.join(","));
  elements.forEach(el => {
    el.addEventListener("click", () => {
      animateButton(el);
    });
  });
}

document.querySelectorAll(".symbol").forEach(s => {
  s.onclick = () => {
    selectButton(s, "symbol", s.textContent, s.classList.contains("multi"));
  };
});
/*--------------------------------------template--------------------------------------*/
document.getElementById("prevTemplate").onclick = () => {
  const maxPage = Math.ceil(templates.length / TEMPLATES_PER_PAGE) - 1;
  currentTemplatePage = currentTemplatePage > 0 ? currentTemplatePage - 1 : maxPage;
  clearAllSelections();
  renderTemplatePage();
};
document.getElementById("nextTemplate").onclick = () => {
  const maxPage = Math.ceil(templates.length / TEMPLATES_PER_PAGE) - 1;
  currentTemplatePage = currentTemplatePage < maxPage ? currentTemplatePage + 1 : 0;
  clearAllSelections();
  renderTemplatePage();
};

/*--------------------------------------color--------------------------------------*/
function updateSelectedSymbolColor() {
  document.querySelectorAll(".symbol, .num-edit-btn").forEach(el => {
    if (el.classList.contains("no-color-sync")) return;
    el.classList.remove("red-active", "blue-active", "green-active");
    if (el.classList.contains("selected")) {
      el.classList.add(selectedColor + "-active");
    }
  });

  document.querySelectorAll(".template-btn").forEach(el => {
    el.classList.remove("red-active", "blue-active", "green-active");
    if (el.classList.contains("selected")) {
      el.classList.add(selectedColor + "-active");
      el.style.color = "";
    } else {
      let colorHex = selectedColor === "red" ? "#ff6666"
                   : selectedColor === "blue" ? "#3399ff"
                   : "#33cc88";
      el.style.color = colorHex;
    }
  });
}

function updateColorButtonsActive() {
  document.querySelectorAll(".color-btn").forEach(btn => {
    if (btn.dataset.color === selectedColor) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

["red","blue","green"].forEach(c => {
  const btn = document.createElement("div");
  btn.className = "color-btn" + (c === "red" ? " active" : "");
  btn.dataset.color = c;
  btn.textContent = c === "red" ? "演算" : c === "blue" ? "循環" : "復元";
  btn.style.background =
    c === "red" ? "#fff0f0" :
    c === "blue" ? "#f0f8ff" :
    "#f0fff4";
  btn.onclick = () => {
    const deleteSelected = selectState.type === "symbol" && selectState.value === "削";
    if (deleteSelected) {
      clearAllSelections();
    }
    document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("active"));
    selectedColor = c;
    btn.classList.add("active");
    updateColorButtonsActive();
    updateSelectedSymbolColor();
  };
  colorGroup.appendChild(btn);
});

/*--------------------------------------ur--------------------------------------*/
function pushHistory() {
  const snapshot = JSON.stringify(boards.map(b => ({
    grid: b.grid.map(row => row.map(cell => ({ ...cell }))),
    part: b.panel.querySelector(".part").value
  })));
  undoStack.push(snapshot);
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
}

function restoreFromSnapshot(snapshot) {
  const data = JSON.parse(snapshot);
  data.forEach((d, i) => {
    const board = boards[i];
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++)
        board.grid[y][x] = { ...d.grid[y][x] };
    const part = d.part || "top";
    board.panel.querySelector(".part").value = part;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++)
        if (board.grid[y][x].symbol === "img") board.grid[y][x].symbol = "";
    const [imgX, imgY] = partPos[part];
    board.grid[imgY][imgX] = { symbol: "img", number: "", multi: false };
    board.drawBoard();
  });
  localStorage.setItem("circuitBoards", snapshot);
}

document.getElementById("undoBtn").onclick = () => {
  const btn = document.getElementById("undoBtn");
  if (undoStack.length === 0) return;
  const current = JSON.stringify(boards.map(b => ({
    grid: b.grid.map(row => row.map(cell => ({ ...cell }))),
    part: b.panel.querySelector(".part").value
  })));
  redoStack.push(current);
  const prev = undoStack.pop();
  restoreFromSnapshot(prev);
};

document.getElementById("redoBtn").onclick = () => {
  const btn = document.getElementById("redoBtn");
  if (redoStack.length === 0) return;
  const current = JSON.stringify(boards.map(b => ({
    grid: b.grid.map(row => row.map(cell => ({ ...cell }))),
    part: b.panel.querySelector(".part").value
  })));
  undoStack.push(current);
  const next = redoStack.pop();
  restoreFromSnapshot(next);
};

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    document.getElementById("undoBtn").click();
  }
  if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
    e.preventDefault();
    document.getElementById("redoBtn").click();
  }
});

/*--------------------------------------change--------------------------------------*/
function handleChangeButton(btn) {
  document.querySelectorAll(".symbol, .template-btn")
    .forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  selectState.type = "numEdit";
  selectState.editMode = (selectState.editMode + 1) % 4;
  if (selectState.editMode === 0) {
    selectState.type = null;
    btn.textContent = "変更";
    btn.classList.remove("selected");
    return;
  }

  if (selectState.editMode === 1) {
    btn.textContent = "数値";
  } else if (selectState.editMode === 2) {
    btn.textContent = "効果";
  } else if (selectState.editMode === 3) {
    btn.textContent = "数/効";
  }
  updateSelectedSymbolColor();
  updateColorButtonsActive();
}

const ChangeBtn = document.getElementById("ChangeBtn");
ChangeBtn.onclick = () => handleChangeButton(ChangeBtn);

/*--------------------------------------clear--------------------------------------*/
const ClearBtn = document.getElementById("ClearBtn");
ClearBtn.onclick = () => {
  clearAllSelections();
  updateSelectedSymbolColor();
  updateColorButtonsActive();
};

/*--------------------------------------delete--------------------------------------*/
const DeleteBtn = document.getElementById("DeleteBtn");
DeleteBtn.onclick = () => {
  const alreadySelected = DeleteBtn.classList.contains("selected");

  if (alreadySelected) {
    DeleteBtn.classList.remove("selected");
    selectState.type = null;
    selectState.value = null;
    selectState.isMulti = false;
    updateColorButtonsActive();
  updateSelectedSymbolColor();
  } else {
    clearAllSelections();
    DeleteBtn.classList.add("selected");
    selectState.type = "symbol";
    selectState.value = "削";
    selectState.isMulti = false;
    document.querySelectorAll(".color-btn").forEach(btn => btn.classList.remove("active"));
    updateSelectedSymbolColor();
  }
};

/*--------------------------------------number--------------------------------------*/
function getSelectedNumber() {
  const checked = document.querySelector('input[name="num"]:checked');
  return checked ? parseFloat(checked.value) : 0;
}

/*--------------------------------------status--------------------------------------*/
const charInput = document.getElementById("charInput");
const charSelect = document.getElementById("charSelect");

function getSelectedChar() {
  return charInput.value.trim() || charSelect.value;
}

charInput.addEventListener("input", () => {
  if (charInput.value.trim() !== "") {
    charSelect.selectedIndex = 0;
  }
});

charSelect.addEventListener("change", () => {
  charInput.value = "";
});

/* ------------------------------------------------------------------------------やばいところ------------------------------------------------------------------------------ */
renderTemplatePage();
const boards = [];
addButtonAnimations()
for (let i = 0; i < 4; i++) {
  let part = savedData?.[i]?.part || initialParts[i];
  const [px, py] = partPos[part];

  const grid = Array.from({ length: 4 }, () =>
    Array(4).fill(null).map(() => ({
      symbol: "",
      number: "",
      char: "",
      multi: false,
      color: "red"
    }))
  );

  grid[py][px] = { symbol: "img", number: "", multi: false };

  if (savedData?.[i]?.grid) {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (savedData[i].grid[y][x].symbol !== "img") {
          grid[y][x] = { ...savedData[i].grid[y][x] };
        }
      }
    }
  }

  const wrap = document.createElement("div");
  wrap.className = "board-wrap";
  wrap.charSumDiv = null;

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <select class="part">
      <option value="top">上衣</option>
      <option value="bottom">下衣</option>
      <option value="glove">手袋</option>
      <option value="shoes">靴</option>
    </select>
  `;
  wrap.appendChild(panel);

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "回路クリア";
  panel.appendChild(clearBtn);

  const board = document.createElement("div");
  board.className = "board";
  wrap.appendChild(board);

  const charSumDiv = document.createElement("div");
  charSumDiv.className = "char-sum-div";
  charSumDiv.textContent = "";
  wrap.appendChild(charSumDiv);
  wrap.charSumDiv = charSumDiv;

  panel.querySelector(".part").value = part;

  const partSelect = panel.querySelector(".part");

  partSelect.addEventListener("mousedown", () => {
    pushHistory();
  });

  partSelect.onchange = () => {
    const p = partSelect.value;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++)
        if (grid[y][x].symbol === "img")
          grid[y][x].symbol = "";

    const [x, y] = partPos[p];
    grid[y][x] = { symbol: "img", number: "", multi: false };

    drawBoard();
    saveBoards();
  };

  clearBtn.onclick = () => {
    if (confirm("回路を全て削除しますか？")) {
      pushHistory();
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++)
          if (grid[y][x].symbol !== "img")
            grid[y][x] = { symbol: "", number: "", multi: false };
      drawBoard();
      saveBoards();
    }
  };

  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const c = document.createElement("div");
      c.className = "cell";

      c.onclick = () => {
        const cell = grid[y][x];
        if (cell.symbol === "img") return;
        if (selectState.type !== "template" && selectState.type !== "numEdit") {
          pushHistory();
        }
        if (!selectState.type && selectedColor && cell.symbol) {
          cell.color = selectedColor;
          drawBoard();
          saveBoards();
          return;
        }

        if (selectState.type === "numEdit") {
          if (!cell.symbol || cell.multi) return;
          pushHistory();
          if (selectedColor) {
            cell.color = selectedColor;
          }
          if (selectState.editMode === 1) {
            cell.number = getSelectedNumber();
          } else if (selectState.editMode === 2) {
            cell.char = getSelectedChar();
          } else if (selectState.editMode === 3) {
            cell.number = getSelectedNumber();
            cell.char = getSelectedChar();
          }
          drawBoard();
          saveBoards();
          return;
        }

        if (selectState.type === "template") {
          pushHistory();
          for (let ty = 0; ty < 4; ty++) {
            for (let tx = 0; tx < 4; tx++) {
              if (grid[ty][tx].symbol === "img") continue;
              const sym = selectState.value.grid[ty][tx];
              if (!sym || sym.trim() === "") {
                grid[ty][tx] = { symbol: "", number: "", char: "", multi: false, color: "red" };
              } else {
                grid[ty][tx] = {
                  symbol: sym,
                  number: getSelectedNumber(),
                  char: getSelectedChar(),
                  multi: false,
                  color: selectedColor
                };
              }
            }
          }
          drawBoard();
          saveBoards();
          return;
        }

        if (selectState.type === "symbol") {
          if (selectState.value === "削") {
            grid[y][x] = { symbol: "", number: "", char: "", multi: false, color: "red" };
          } else {
            grid[y][x] = {
              symbol: selectState.value,
              number: selectState.isMulti ? "" : getSelectedNumber(),
              char: selectState.isMulti ? "" : getSelectedChar(),
              multi: selectState.isMulti,
              color: selectedColor
            };
          }
          drawBoard();
          saveBoards();
        }
      };

      c.oncontextmenu = (e) => {
        e.preventDefault();
        pushHistory();
        const cell = grid[y][x];
        if (cell.symbol === "img") return;
        grid[y][x] = { symbol: "", number: "", char: "", multi: false, color: "red" };
        drawBoard();
        saveBoards();
      };

      board.appendChild(c);
    }
  }

  function drawBoard() {
    board.querySelectorAll(".cell").forEach((c, i) => {
      const y = Math.floor(i / 4);
      const x = i % 4;
      const s = grid[y][x];
      const part = panel.querySelector(".part").value;
      const circleImages = { top: "top.png", bottom: "bottom.png", glove: "glove.png", shoes: "shoes.png" };
      let symbolHTML = s.symbol;

      if (s.symbol === "img" && circleImages[part]) symbolHTML = `<img src="${circleImages[part]}" class="img">`;

      c.innerHTML = `
        <div class="symbol-display">${symbolHTML}</div>
        ${s.multi ? `<div class="multi-label">複</div>` : ``}
        <div class="char-display">${s.char || ""}</div>
        <div class="number-display">${s.number || ""}</div>
      `;
      c.className = "cell";
      if (!s.symbol) {
        c.style.background = "";
      } else if (s.multi) {
        c.style.background = "#ffffaa";
      } else if (s.color === "red") {
        c.style.background = "#fff0f0";
      } else if (s.color === "blue") {
        c.style.background = "#f0f8ff";
      } else if (s.color === "green") {
        c.style.background = "#f0fff4";
      } else {
        c.style.background = "";
      }
    });

    updateBoard();
  }

  function updateBoard() {
      const dx = { l: -1, r: 1, u: 0, d: 0 };
      const dy = { l: 0, r: 0, u: -1, d: 1 };
      const opp = { l: "r", r: "l", u: "d", d: "u" };
      const charOrder = Array.from(charSelect.options)
          .map(o => o.value)
          .filter(v => v !== "");

      let cx = -1, cy = -1;
      for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 4; x++) {
              if (grid[y][x].symbol === "img") {
                  cx = x;
                  cy = y;
              }
          }
      }

      if (cx === -1) {
          board.querySelectorAll(".cell").forEach(c => c.className = "cell");
          wrap.charSumDiv.textContent = "";
          return;
      }

      const imgRoutes = [];

      for (const d in dx) {
          const nx = cx + dx[d];
          const ny = cy + dy[d];
          const t = grid[ny]?.[nx];

          if (
              t &&
              t.symbol &&
              connections[t.symbol] &&
              connections[t.symbol][opp[d]]
          ) {
              imgRoutes.push({ x: nx, y: ny, from: d });
          }
      }

      if (imgRoutes.length < 2) {
          board.querySelectorAll(".cell").forEach(c => c.className = "cell");
          wrap.charSumDiv.textContent = "";
          return;
      }

      function traceRoute(startX, startY, fromDir) {
          const visited = new Set();
          const stack = [{ x: startX, y: startY, from: fromDir }];

          while (stack.length) {
              const { x, y, from } = stack.pop();
              const key = x + "," + y;
              if (visited.has(key)) continue;
              visited.add(key);

              const s = grid[y][x];
              if (!s || !connections[s.symbol]) continue;

              for (const d in dx) {
                  if (d === from) continue;
                  if (!connections[s.symbol][d]) continue;

                  const nx = x + dx[d];
                  const ny = y + dy[d];
                  const t = grid[ny]?.[nx];
                  if (
                      t &&
                      t.symbol &&
                      connections[t.symbol] &&
                      connections[t.symbol][opp[d]]
                  ) {
                      stack.push({ x: nx, y: ny, from: opp[d] });
                  }
              }
          }

          return visited.size;
      }

      let validRoutes = 0;

      for (const r of imgRoutes) {
          const size = traceRoute(r.x, r.y, opp[r.from]);
          if (size >= 2) validRoutes++;
      }

      if (validRoutes < 2) {
          board.querySelectorAll(".cell").forEach(c => c.className = "cell");
          wrap.charSumDiv.textContent = "";
          return;
      }

      const visited = Array.from({ length: 4 }, () => Array(4).fill(false));
      const stack = [[cx, cy]];
      visited[cy][cx] = true;
      let invalid = false;

      while (stack.length && !invalid) {
          const [x, y] = stack.pop();
          const s = grid[y][x];

          for (const d in dx) {
              const nx = x + dx[d];
              const ny = y + dy[d];

              if (connections[s.symbol]?.[d]) {
                  if (nx < 0 || nx >= 4 || ny < 0 || ny >= 4) {
                      invalid = true;
                      break;
                  }
              }

              const t = grid[ny]?.[nx];
              if (!t) continue;

              if (s.symbol === "img") {
                  if (t.symbol && connections[t.symbol]) {
                      if (!connections[t.symbol]?.[opp[d]]) {
                          invalid = true;
                          break;
                      }
                      if (!visited[ny][nx]) {
                          visited[ny][nx] = true;
                          stack.push([nx, ny]);
                      }
                  }
                  continue;
              }

              if (connections[s.symbol]?.[d]) {
                  if (!t.symbol) {
                      invalid = true;
                      break;
                  }
                  if (t.symbol === "img") {
                      if (!visited[ny][nx]) {
                          visited[ny][nx] = true;
                          stack.push([nx, ny]);
                      }
                  } else {
                      if (!connections[t.symbol]?.[opp[d]]) {
                          invalid = true;
                          break;
                      }
                      if (!visited[ny][nx]) {
                          visited[ny][nx] = true;
                          stack.push([nx, ny]);
                      }
                  }
              }
          }
      }

      if (invalid) {
          board.querySelectorAll(".cell").forEach(c => c.className = "cell");
          wrap.charSumDiv.textContent = "";
          return;
      }

      const charSumTotal = {};
      const charSumMulti = {};

      board.querySelectorAll(".cell").forEach((c, i) => {
          const y = Math.floor(i / 4);
          const x = i % 4;
          const s = grid[y][x];

          c.className = "cell";
          if (!visited[y][x]) return;

          const cellCharValue = {};

          if (s.multi) {
              for (const d in dx) {
                  const nx = x + dx[d];
                  const ny = y + dy[d];
                  const t = grid[ny]?.[nx];

                  if (
                      t &&
                      visited[ny][nx] &&
                      !t.multi &&
                      t.number &&
                      connections[s.symbol]?.[d] &&
                      connections[t.symbol]?.[opp[d]]
                  ) {
                      const half = parseFloat(t.number) / 2;
                      const key = t.char && t.char.trim() !== "" ? t.char : "指定なし";
                      cellCharValue[key] = (cellCharValue[key] || 0) + half;
                  }
              }
          } else {
              const n = parseFloat(s.number);
              if (!isNaN(n)) {
                  const key = s.char && s.char.trim() !== "" ? s.char : "指定なし";
                  cellCharValue[key] = n;
              }
          }

          for (const ch in cellCharValue) {
              charSumTotal[ch] = (charSumTotal[ch] || 0) + cellCharValue[ch];
              if (s.multi) {
                  charSumMulti[ch] = (charSumMulti[ch] || 0) + cellCharValue[ch];
              }
          }

          if (connections[s.symbol]) {
              c.classList.add("connected", "highlight-" + (s.color || "red"));
          }
      });

      wrap.charSumDiv.innerHTML = `
          <div class="sum-grid sum-header">
              <div></div>
              <div>複製増加分</div>
              <div>合計</div>
          </div>
          <div class="sum-grid">
              ${
                  Object.entries(charSumTotal)
                      .sort((a, b) => {
                          if (b[1] !== a[1]) return b[1] - a[1];
                          const ia = charOrder.indexOf(a[0]);
                          const ib = charOrder.indexOf(b[0]);
                          if (a[0] === "指定なし") return 1;
                          if (b[0] === "指定なし") return -1;
                          return ia - ib;
                      })
                      .map(([k, v]) => {
                          const multi = charSumMulti[k] || 0;
                          return `
                              <div class="sum-name">${k}</div>
                              <div class="sum-multi">${multi > 0 ? multi.toFixed(2) : ""}</div>
                              <div class="sum-total">${v.toFixed(2)}</div>
                          `;
                      })
                      .join("")
              }
          </div>
      `;
  }

  wrap.drawBoard = drawBoard;
  wrap.grid = grid;
  wrap.panel = panel;
  boards.push(wrap);
  boardsEl.appendChild(wrap);
  drawBoard();
  undoStack = [];
redoStack = [];
pushHistory();
}
pushHistory();

/* ------------------------------------------------------------------------------保存------------------------------------------------------------------------------ */
function saveBoards() {
  const data = boards.map(b => ({
    grid: b.grid.map(row =>
      row.map(cell => ({
        symbol: cell.symbol || "",
        number: cell.number || "",
        char: cell.char || "",
        multi: !!cell.multi,
        color: cell.color || "red"
      }))
    ),
    part: b.panel.querySelector(".part").value || "top"
  }));

  localStorage.setItem("circuitBoards", JSON.stringify(data));
}

/*--------------------------------------セーブスロット--------------------------------------*/
const slotCount = 15;
const slotsPerPage = 5;
let currentSlotPage = 0;
const slotContainer = document.getElementById("slotButtons");

function renderSlotPage() {
  slotContainer.innerHTML = "";

  const start = currentSlotPage * slotsPerPage;
  const end = start + slotsPerPage;

  for (let i = start + 1; i <= Math.min(end, slotCount); i++) {
    const div = document.createElement("div");

    const input = document.createElement("input");
    input.type = "text";
    input.className = "slot-name";
    input.value = localStorage.getItem("circuitBoards_slot" + i + "_name") || ("スロット" + i);
    div.appendChild(input);

    const saveBtn = document.createElement("button");
    saveBtn.className = "saveBtn";
    saveBtn.dataset.slot = i;
    saveBtn.textContent = "保存";
    div.appendChild(saveBtn);

    const loadBtn = document.createElement("button");
    loadBtn.className = "loadBtn";
    loadBtn.dataset.slot = i;
    loadBtn.textContent = "読み込み";
    div.appendChild(loadBtn);

    slotContainer.appendChild(div);
  }

  const totalPages = Math.ceil(slotCount / slotsPerPage);
  document.getElementById("slotPageLabel").textContent =
    (currentSlotPage + 1) + " / " + totalPages;

  attachSlotEvents();
}

function attachSlotEvents() {
  document.querySelectorAll(".saveBtn").forEach(btn => {
    btn.onclick = () => {
      const slot = btn.dataset.slot;
      const slotDiv = btn.parentElement;
      const slotName = slotDiv.querySelector(".slot-name").value || ("スロット" + slot);
      if (!confirm(slotName + " に保存しますか？")) return;
      try {
        const saveData = boards.map(b => ({
          grid: b.grid.map(row =>
            row.map(cell => ({
              symbol: cell.symbol || "",
              number: cell.number || "",
              char: cell.char || "",
              multi: !!cell.multi,
              color: cell.color || "red"
            }))
          ),
          part: b.panel.querySelector(".part").value || "top"
        }));
        localStorage.setItem("circuitBoards_slot" + slot, JSON.stringify(saveData));
        localStorage.setItem("circuitBoards_slot" + slot + "_name", slotName);
        addChangelog(slotName + " に保存しました : " + new Date().toLocaleString());
      } catch (e) {
        alert("保存に失敗しました : " + e.message);
      }
    };
  });

  document.querySelectorAll(".loadBtn").forEach(btn => {
    btn.onclick = () => {
      const slot = btn.dataset.slot;
      const data = localStorage.getItem("circuitBoards_slot" + slot);
      const slotName = localStorage.getItem("circuitBoards_slot" + slot + "_name") || ("スロット" + slot);
      if (!data) {
        alert(slotName + " は空です");
        return;
      }
      try {
        pushHistory();
        const parsed = JSON.parse(data);
        parsed.forEach((d, i) => {
          for (let y = 0; y < 4; y++)
            for (let x = 0; x < 4; x++)
              boards[i].grid[y][x] = { ...d.grid[y][x] };
          boards[i].panel.querySelector(".part").value = d.part || "top";
          boards[i].drawBoard();
        });
        addChangelog(slotName + " から読み込みました : " + new Date().toLocaleString());
      } catch (e) {
        alert(slotName + " のデータが壊れています");
      }
    };
  });
}

document.getElementById("prevSlot").onclick = () => {
  const maxPage = Math.ceil(slotCount / slotsPerPage) - 1;
  currentSlotPage = currentSlotPage > 0 ? currentSlotPage - 1 : maxPage;
  renderSlotPage();
};

document.getElementById("nextSlot").onclick = () => {
  const maxPage = Math.ceil(slotCount / slotsPerPage) - 1;
  currentSlotPage = currentSlotPage < maxPage ? currentSlotPage + 1 : 0;
  renderSlotPage();
};

renderSlotPage();

/*--------------------------------------EX/IN--------------------------------------*/
const exportAllBtn = document.createElement("button");
exportAllBtn.textContent = "ファイル出力";
const importAllBtn = document.createElement("button");
importAllBtn.textContent = "ファイル読み込み";
const importAllFile = document.createElement("input");
importAllFile.type = "file";
importAllFile.accept = ".txt";
importAllFile.style.display = "none";

document.querySelector(".right").appendChild(exportAllBtn);
document.querySelector(".right").appendChild(importAllBtn);
document.querySelector(".right").appendChild(importAllFile);
exportAllBtn.style.width = "150px";
importAllBtn.style.width = "150px";
exportAllBtn.style.marginRight = "12px";

exportAllBtn.onclick = () => {
  try {
    const slotsData = {};
    for (let i = 1; i <= 5; i++) {
      const slotName = localStorage.getItem("circuitBoards_slot" + i + "_name") || ("スロット" + i);
      const slotData = localStorage.getItem("circuitBoards_slot" + i) || null;
      slotsData[i] = { name: slotName, data: slotData };
    }

    const boardsData = boards.map(b => ({
      grid: b.grid.map(r => r.map(c => ({
        symbol: c.symbol || "",
        number: c.number || "",
        char: c.char || "",
        multi: !!c.multi,
        color: c.color || "red"
      }))),
      part: b.panel.querySelector(".part").value || "top"
    }));

    const exportData = { boards: boardsData, slots: slotsData };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "text/plain" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "circuitSimulator.txt";
    a.click();
    URL.revokeObjectURL(url);

    const now = new Date().toLocaleString();
    addChangelog(`ファイルを保存しました : ${now}`);
  } catch (err) {
    alert("エクスポート出来ませんでした : " + err.message);
    console.error(err);
  }
};

importAllBtn.onclick = () => importAllFile.click();

importAllFile.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);

      if (parsed.boards && Array.isArray(parsed.boards)) {
        parsed.boards.forEach((d, i) => {
          for (let y = 0; y < 4; y++)
            for (let x = 0; x < 4; x++)
              boards[i].grid[y][x] = { ...d.grid[y][x] };
          boards[i].panel.querySelector(".part").value = d.part || "top";
          boards[i].drawBoard();
        });
      }

      if (parsed.slots) {
        for (let i = 1; i <= 5; i++) {
          if (parsed.slots[i]) {
            localStorage.setItem("circuitBoards_slot" + i, parsed.slots[i].data || null);
            localStorage.setItem("circuitBoards_slot" + i + "_name", parsed.slots[i].name || ("スロット" + i));
            const slotDiv = document.querySelectorAll(".slot-buttons div")[i - 1];
            slotDiv.querySelector(".slot-name").value = parsed.slots[i].name || ("スロット" + i);
          }
        }
      }

      const now = new Date().toLocaleString();
      addChangelog(`${file.name} を読み込みました : ${now}`);
    } catch (err) {
      alert("ファイルが正しくありません : " + err.message);
      console.error(err);
    }
  };
  reader.readAsText(file, "UTF-8");
  importAllFile.value = "";
};

/* ------------------------------------------------------------------------------りれき------------------------------------------------------------------------------ */
function addChangelog(text) {
  const ul = document.getElementById("changelogList");
  const li = document.createElement("li");
  li.textContent = text;
  ul.prepend(li);
}