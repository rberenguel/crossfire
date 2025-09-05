// --- CONFIG ---
const BOARD_SIZE = 8;
const CELL_SIZE = 60;
const GRID_COLOR = 0x00ffff;
const SHIP_COLORS = [0xff4444, 0x4444ff]; // Red, Blue

// --- PIXI APP SETUP ---
const canvasContainer = document.getElementById("pixi-canvas");

(async () => {
  const app = new PIXI.Application();
  await app.init({
    width: BOARD_SIZE * CELL_SIZE,
    height: BOARD_SIZE * CELL_SIZE,
    backgroundColor: 0x0a0a2a,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  canvasContainer.appendChild(app.view);
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  app.stage.on("pointerdown", (e) => handleCanvasClick(e));

  // --- UI ELEMENTS ---
  const gameStatusEl = document.getElementById("game-status");
  const playerInfoEl = document.getElementById("player-info");
  const actionsPanelEl = document.getElementById("actions-panel");
  const orientationPanelEl = document.getElementById("orientation-panel");
  const orientationTitleEl = document.getElementById("orientation-title");
  const actionsLeftEl = document.getElementById("actions-left");
  const winnerModalEl = document.getElementById("winner-modal");
  const winnerTextEl = document.getElementById("winner-text");

  document
    .getElementById("btn-fire")
    .addEventListener("click", () => handleAction("fire"));
  document
    .getElementById("btn-accel")
    .addEventListener("click", () => handleAction("accelerate"));
  document
    .getElementById("btn-decel")
    .addEventListener("click", () => handleAction("decelerate"));
  document
    .getElementById("btn-turn-left")
    .addEventListener("click", () => handleAction("turnLeft"));
  document
    .getElementById("btn-turn-right")
    .addEventListener("click", () => handleAction("turnRight"));
  document.getElementById("btn-end-turn").addEventListener("click", () => {
    if (selectedShip && gameState.phase === "ACTION") {
      endPlayerTurn();
    }
  });
  document.getElementById("btn-restart").addEventListener("click", () => {
    winnerModalEl.classList.add("hidden");
    initGame();
  });
  document.querySelectorAll(".orient-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const orient = parseInt(e.target.dataset.orient);
      if (gameState.phase === "SETUP_ORIENT") {
        handleAction("orient", orient);
      } else if (
        gameState.phase === "ACTION" &&
        gameState.subPhase === "ORIENT_CHOICE" &&
        selectedShip
      ) {
        selectedShip.orientation = orient;
        if (!selectedShip.actionsTakenThisTurn.includes("turn")) {
          selectedShip.actionsLeft--;
          selectedShip.actionsTakenThisTurn.push("turn");
        }
        gameState.subPhase = null;
        updateShipGraphics(selectedShip);
        updateUIPanels();
      }
    });
  });

  // --- GAME STATE ---
  let gameState;
  let players;
  let asteroids;
  let selectedShip = null;

  // --- GAME OBJECTS & LOGIC ---
  const directions = [
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: -1 },
    { x: -1, y: -1 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ];
  const directionAngle = [0, -45, -90, -135, 180, 135, 90, 45];
  const actionTypes = {
    fire: "fire",
    accelerate: "speed",
    decelerate: "speed",
    turnLeft: "turn",
    turnRight: "turn",
  };

  class FireParticle extends PIXI.Graphics {
    constructor(color, initialX, initialY, initialRotation) {
      super();
      this.x = initialX;
      this.y = initialY;
      this.rotation = initialRotation;
      this.blendMode = "add";
      this.beginFill(color, 1).drawCircle(0, 0, 5).endFill();
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = (Math.random() - 0.5) * 2;
      this.life = 60 + Math.random() * 60;
      this.maxLife = this.life;
      this.initialScale = 1 + Math.random();
      this.scale.set(this.initialScale);
      PIXI.Ticker.shared.add(this.update, this);
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.alpha = this.life / this.maxLife;
      this.scale.set(this.initialScale * (this.life / this.maxLife));
      this.life--;
      if (this.life <= 0) {
        PIXI.Ticker.shared.remove(this.update, this);
        this.destroy();
      }
    }
  }
  class LaserBeam extends PIXI.Container {
    constructor(color, startX, startY, rotation, length, thickness) {
      super();
      this.x = startX;
      this.y = startY;
      this.rotation = rotation;
      this.alpha = 0;
      const glow = new PIXI.Graphics()
        .beginFill(color, 0.7)
        .drawRect(0, -thickness, length, thickness * 2)
        .endFill();
      const core = new PIXI.Graphics()
        .beginFill(0xffffff, 1)
        .drawRect(0, -thickness / 2, length, thickness)
        .endFill();
      this.addChild(glow, core);
      this.life = 0;
      this.maxLife = 20;
      PIXI.Ticker.shared.add(this.update, this);
    }
    update() {
      this.life++;
      if (this.life <= this.maxLife / 2) {
        this.alpha = this.life / (this.maxLife / 2);
      } else if (this.life > this.maxLife / 2 && this.life <= this.maxLife) {
        this.alpha = (this.maxLife - this.life) / (this.maxLife / 2);
      } else {
        PIXI.Ticker.shared.remove(this.update, this);
        this.destroy();
      }
    }
  }

  function createShip(id, x, y, speed, orientation) {
    const ship = {
      id,
      hp: 6,
      speed,
      orientation,
      x,
      y,
      actionsLeft: 2,
      asteroidsCaptured: 0,
      actionsTakenThisTurn: [],
      isPhasing: false,
      container: null,
      text: null,
      shapeData: null,
      orientationAtTurnStart: 0,
      turnDelta: 0,
    };
    ship.container = new PIXI.Container();
    ship.container.x = x * CELL_SIZE + CELL_SIZE / 2;
    ship.container.y = y * CELL_SIZE + CELL_SIZE / 2;
    ship.container.eventMode = "static";
    ship.container.cursor = "pointer";
    const lynxVertices = [
      [-70, 50],
      [70, 0],
      [-70, -50],
      [-30, 0],
      [-70, 50],
    ];
    const scale = CELL_SIZE / 180;
    ship.shapeData = lynxVertices.flat().map((v) => v * scale);
    const body = new PIXI.Graphics()
      .poly(ship.shapeData)
      .fill({ color: SHIP_COLORS[id] });
    const border = new PIXI.Graphics();
    border.name = "border";
    ship.text = new PIXI.Text({
      text: String(ship.speed),
      style: {
        fill: "white",
        fontSize: 24,
        fontWeight: "bold",
        stroke: { color: "#000000", width: 4, join: "round" },
      },
    });
    ship.text.anchor.set(0.5);
    ship.container.addChild(body, ship.text, border);
    app.stage.addChild(ship.container);
    ship.container.on("pointerdown", (event) => {
      event.stopPropagation();
      selectShip(ship);
    });
    return ship;
  }

  function generateAsteroidVertices(size, sides) {
    let path = [];
    const a = (Math.PI * 2) / sides;
    for (let i = 0; i < sides; i++) {
      const wiggled = i * a + 0.3 * a + 0.6 * a * Math.random();
      const radius = size + size * 0.2 * Math.random();
      path.push([radius * Math.cos(wiggled), radius * Math.sin(wiggled)]);
    }
    return path;
  }

  function createAsteroid(x, y, hp) {
    const asteroid = { hp, x, y, container: null, text: null };
    asteroid.container = new PIXI.Container();
    asteroid.container.x = x * CELL_SIZE + CELL_SIZE / 2;
    asteroid.container.y = y * CELL_SIZE + CELL_SIZE / 2;
    const vertices = generateAsteroidVertices(CELL_SIZE / 2.5, 9);
    const body = new PIXI.Graphics().poly(vertices.flat()).fill(0x964b00);
    asteroid.text = new PIXI.Text({
      text: String(asteroid.hp),
      style: { fill: "white", fontSize: 20, fontWeight: "bold" },
    });
    asteroid.text.anchor.set(0.5);
    asteroid.container.addChild(body, asteroid.text);
    app.stage.addChild(asteroid.container);
    return asteroid;
  }

  function updateShipGraphics(ship) {
    if (!ship || !ship.container || ship.container.destroyed) return;
    ship.text.text = String(ship.speed);
    ship.container.rotation =
      directionAngle[ship.orientation] * (Math.PI / 180);
    ship.text.rotation = -ship.container.rotation;
    updateUI();
  }

  function isOccupied(x, y, objects) {
    return objects.some((c) => c.x === x && c.y === y);
  }

  function initGame() {
    app.stage.removeChildren();
    const grid = new PIXI.Graphics();
    for (let i = 0; i <= BOARD_SIZE; i++) {
      grid
        .rect(i * CELL_SIZE, 0, 1, BOARD_SIZE * CELL_SIZE)
        .rect(0, i * CELL_SIZE, BOARD_SIZE * CELL_SIZE, 1);
    }
    grid.fill({ color: GRID_COLOR, alpha: 0.2 });
    app.stage.addChild(grid);
    gameState = {
      phase: "SETUP_ROLL",
      turn: 0,
      winner: null,
      setupSubPhase: 0,
      firstMoverId: 0,
      subPhase: null,
    };
    players = [];
    asteroids = [];
    selectedShip = null;
    updateUI();
  }

  function handleCanvasClick(event) {
    const x = Math.floor(event.global.x / CELL_SIZE);
    const y = Math.floor(event.global.y / CELL_SIZE);
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return;
    if (gameState.phase.startsWith("SETUP_PLACE_")) {
      if (!isOccupied(x, y, players.concat(asteroids))) {
        runSetup(x, y);
      }
    }
  }

  function runSetup(arg1, arg2) {
    switch (gameState.phase) {
      case "SETUP_ROLL":
        let p1roll, p2roll;
        do {
          p1roll = Math.floor(Math.random() * 6) + 1;
          p2roll = Math.floor(Math.random() * 6) + 1;
        } while (p1roll === p2roll);
        gameState.firstMoverId = p1roll > p2roll ? 0 : 1;
        gameState.turn = gameState.firstMoverId;
        players.push({ id: 0, speed: Math.max(3, p1roll) });
        players.push({ id: 1, speed: Math.max(3, p2roll) });
        gameState.phase = "SETUP_PLACE_SHIP";
        break;
      case "SETUP_PLACE_SHIP":
        const p = players.find((pl) => pl.id === gameState.turn);
        players[players.indexOf(p)] = createShip(p.id, arg1, arg2, p.speed, 0);
        gameState.turn = (gameState.turn + 1) % 2;
        if (players.filter((pl) => pl.container).length === 2) {
          gameState.turn = gameState.firstMoverId;
          gameState.phase = "SETUP_PLACE_ASTEROID";
        }
        break;
      case "SETUP_PLACE_ASTEROID":
        const hp = Math.max(3, Math.floor(Math.random() * 6) + 1);
        asteroids.push(createAsteroid(arg1, arg2, hp));
        gameState.turn = (gameState.turn + 1) % 2;
        if (asteroids.length === 3) {
          gameState.turn = gameState.firstMoverId;
          gameState.phase = "SETUP_ORIENT";
        }
        break;
      case "SETUP_ORIENT":
        gameState.setupSubPhase++;
        gameState.turn = (gameState.turn + 1) % 2;
        if (gameState.setupSubPhase === 2) {
          startTurn(gameState.firstMoverId);
        }
        break;
    }
    updateUI();
  }

  function selectShip(ship) {
    if (gameState.phase === "ACTION" && ship.id !== gameState.turn) return;
    deselectAll();
    selectedShip = ship;
    const border = ship.container.getChildByName("border");
    border.stroke({ width: 4, color: 0x00ffff, alpha: 1 }).poly(ship.shapeData);
    updateUIPanels();
  }

  function deselectAll() {
    players.forEach((p) => {
      if (p.container) p.container.getChildByName("border")?.clear();
    });
    selectedShip = null;
    updateUIPanels();
  }

  function startTurn(playerId) {
    gameState.phase = "ACTION";
    gameState.subPhase = null;
    gameState.turn = playerId;
    const currentPlayer = players.find((p) => p.id === playerId);
    currentPlayer.actionsLeft = 2;
    currentPlayer.actionsTakenThisTurn = [];
    currentPlayer.orientationAtTurnStart = currentPlayer.orientation;
    currentPlayer.turnDelta = 0;
    deselectAll();
    updateUI();
  }

  async function handleAction(actionType, value) {
    if (
      !selectedShip ||
      (selectedShip.actionsLeft <= 0 &&
        actionType !== "turnLeft" &&
        actionType !== "turnRight")
    )
      return;
    const ship = selectedShip;

    if (
      gameState.phase === "ACTION" &&
      gameState.subPhase !== "ORIENT_CHOICE"
    ) {
      const typeKey = actionTypes[actionType];
      const isFirstActionOfType = !ship.actionsTakenThisTurn.includes(typeKey);

      switch (actionType) {
        case "fire":
          if (isFirstActionOfType && ship.actionsLeft > 0) {
            ship.actionsLeft--;
            ship.actionsTakenThisTurn.push(typeKey);
            await fireLaser(ship);
          }
          break;
        case "accelerate":
          if (
            isFirstActionOfType &&
            ship.actionsLeft > 0 &&
            ship.speed < ship.hp &&
            ship.speed < 6
          ) {
            ship.actionsLeft--;
            ship.actionsTakenThisTurn.push(typeKey);
            ship.speed++;
          }
          break;
        case "decelerate":
          if (isFirstActionOfType && ship.actionsLeft > 0 && ship.speed > 1) {
            ship.actionsLeft--;
            ship.actionsTakenThisTurn.push(typeKey);
            ship.speed--;
          }
          break;
        case "turnLeft":
          if (ship.speed === 1) {
            if (isFirstActionOfType && ship.actionsLeft > 0) {
              gameState.subPhase = "ORIENT_CHOICE";
            }
          } else {
            if (isFirstActionOfType && ship.actionsLeft > 0) {
              ship.actionsLeft--;
              ship.actionsTakenThisTurn.push("turn");
            }
            if (
              ship.actionsTakenThisTurn.includes("turn") &&
              ship.turnDelta < 1
            ) {
              ship.turnDelta++;
              ship.orientation =
                (ship.orientationAtTurnStart + ship.turnDelta + 8) % 8;
            }
          }
          break;
        case "turnRight":
          if (ship.speed === 1) {
            if (isFirstActionOfType && ship.actionsLeft > 0) {
              gameState.subPhase = "ORIENT_CHOICE";
            }
          } else {
            if (isFirstActionOfType && ship.actionsLeft > 0) {
              ship.actionsLeft--;
              ship.actionsTakenThisTurn.push("turn");
            }
            if (
              ship.actionsTakenThisTurn.includes("turn") &&
              ship.turnDelta > -1
            ) {
              ship.turnDelta--;
              ship.orientation =
                (ship.orientationAtTurnStart + ship.turnDelta + 8) % 8;
            }
          }
          break;
      }
      updateUIPanels();
    } else if (gameState.phase === "SETUP_ORIENT" && actionType === "orient") {
      ship.orientation = value;
      runSetup();
    }

    updateShipGraphics(ship);
  }

  function endPlayerTurn() {
    const secondMoverId = 1 - gameState.firstMoverId;
    if (gameState.turn === gameState.firstMoverId) {
      startTurn(secondMoverId);
    } else {
      startMovementPhase();
    }
  }

  async function fireLaser(ship) {
    const shipAngleRad = directionAngle[ship.orientation] * (Math.PI / 180);
    const tipOffset = CELL_SIZE / 2.5;
    const startX = ship.container.x + Math.cos(shipAngleRad) * tipOffset;
    const startY = ship.container.y + Math.sin(shipAngleRad) * tipOffset;
    for (let i = 0; i < 5; i++) {
      app.stage.addChild(
        new FireParticle(SHIP_COLORS[ship.id], startX, startY, shipAngleRad),
      );
    }
    app.stage.addChild(
      new LaserBeam(
        SHIP_COLORS[ship.id],
        startX,
        startY,
        shipAngleRad,
        BOARD_SIZE * CELL_SIZE * 1.5,
        3,
      ),
    );
    for (let i = 1; i < BOARD_SIZE; i++) {
      const checkX = ship.x + directions[ship.orientation].x * i;
      const checkY = ship.y + directions[ship.orientation].y * i;
      if (
        checkX < 0 ||
        checkX >= BOARD_SIZE ||
        checkY < 0 ||
        checkY >= BOARD_SIZE
      )
        break;
      const otherPlayer = players.find(
        (p) => p.id !== ship.id && p.x === checkX && p.y === checkY,
      );
      if (otherPlayer) {
        otherPlayer.hp--;
        enforceGoldenRule(otherPlayer);
        break;
      }
      const asteroid = asteroids.find((a) => a.x === checkX && a.y === checkY);
      if (asteroid) {
        asteroid.hp--;
        asteroid.text.text = String(asteroid.hp);
        if (asteroid.hp <= 0) captureAsteroid(ship, asteroid);
        break;
      }
    }
    updateUI();
    checkWinConditions();
  }

  function enforceGoldenRule(ship) {
    if (ship.speed > ship.hp) {
      ship.speed = ship.hp;
      updateShipGraphics(ship);
    }
  }

  function captureAsteroid(ship, asteroid) {
    ship.asteroidsCaptured++;
    if (asteroid.container && !asteroid.container.destroyed)
      app.stage.removeChild(asteroid.container);
    asteroids.splice(asteroids.indexOf(asteroid), 1);
  }

  function startMovementPhase() {
    gameState.phase = "MOVEMENT";
    updateUI();
    const moves = players.map((p) => {
      p.isPhasing = false;
      const moveDist = Math.ceil(p.speed / 2);
      const path = Array.from({ length: moveDist }, (_, i) => ({
        x:
          (p.x + directions[p.orientation].x * (i + 1) + BOARD_SIZE) %
          BOARD_SIZE,
        y:
          (p.y + directions[p.orientation].y * (i + 1) + BOARD_SIZE) %
          BOARD_SIZE,
      }));
      return {
        player: p,
        path,
        finalPos: path.length > 0 ? path[path.length - 1] : { x: p.x, y: p.y },
      };
    });
    resolveMovement(moves);
  }

  async function resolveMovement(moves) {
    const p1 = moves[0].player,
      p2 = moves[1].player;
    const pathsIntersect = moves[0].path.some((pos1) =>
      moves[1].path.some((pos2) => pos1.x === pos2.x && pos1.y === pos2.y),
    );
    const endOnSameSquare =
      moves[0].finalPos.x === moves[1].finalPos.x &&
      moves[0].finalPos.y === moves[1].finalPos.y;
    if (pathsIntersect || endOnSameSquare) {
      if (p1.hp > p2.hp) {
        endGame(p1);
        return;
      }
      if (p2.hp > p1.hp) {
        endGame(p2);
        return;
      }
      if (p1.hp === p2.hp) {
        p1.isPhasing = p2.isPhasing = true;
      }
    }
    for (const move of moves) {
      let stopped = false;
      for (const pos of move.path) {
        const asteroid = asteroids.find((a) => a.x === pos.x && a.y === pos.y);
        if (asteroid) {
          move.player.hp -= asteroid.hp;
          if (move.player.hp > 0)
            move.player.speed = Math.max(1, move.player.speed - 1);
          enforceGoldenRule(move.player);
          captureAsteroid(move.player, asteroid);
          move.player.x = pos.x;
          move.player.y = pos.y;
          stopped = true;
          break;
        }
      }
      if (!stopped) {
        move.player.x = move.finalPos.x;
        move.player.y = move.finalPos.y;
      }
    }
    const ticker = PIXI.Ticker.shared;
    const animation = () => {
      let done = players.every((p) => {
        if (p.isPhasing) p.container.alpha = 0.5;
        const targetX = p.x * CELL_SIZE + CELL_SIZE / 2,
          targetY = p.y * CELL_SIZE + CELL_SIZE / 2;
        const dx = targetX - p.container.x,
          dy = targetY - p.container.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
          p.container.x = targetX;
          p.container.y = targetY;
          return true;
        }
        p.container.x += dx * 0.1 * PIXI.Ticker.shared.deltaTime;
        p.container.y += dy * 0.1 * PIXI.Ticker.shared.deltaTime;
        return false;
      });
      if (done) {
        ticker.remove(animation);
        players.forEach((p) => {
          p.container.alpha = 1;
          p.isPhasing = false;
          updateShipGraphics(p);
        });
        checkWinConditions();
        if (!gameState.winner) {
          startTurn(gameState.firstMoverId);
        }
      }
    };
    ticker.add(animation);
  }

  function checkWinConditions() {
    if (gameState.winner) return;
    players.forEach((p) => {
      if (p.hp <= 0) endGame(players.find((winner) => winner.id !== p.id));
      if (p.asteroidsCaptured >= 2) endGame(p);
    });
  }

  function endGame(winner) {
    if (gameState.winner || !winner) return;
    gameState.winner = winner;
    winnerTextEl.textContent = `Player ${winner.id + 1} Wins!`;
    winnerModalEl.classList.remove("hidden");
    deselectAll();
  }

  function updateUIPanels() {
    const isActionPhase = gameState.phase === "ACTION";
    const showActions =
      selectedShip && isActionPhase && gameState.subPhase !== "ORIENT_CHOICE";
    const showSetupOrient =
      selectedShip &&
      gameState.phase === "SETUP_ORIENT" &&
      selectedShip.id === gameState.turn;
    const showActionOrient =
      selectedShip && isActionPhase && gameState.subPhase === "ORIENT_CHOICE";
    actionsPanelEl.classList.toggle("hidden", !showActions);
    orientationPanelEl.classList.toggle(
      "hidden",
      !showSetupOrient && !showActionOrient,
    );
    if (showSetupOrient) orientationTitleEl.textContent = "Set Orientation";
    if (showActionOrient) orientationTitleEl.textContent = "Re-orient Ship";
    if (showActions) updateActionButtons();
  }

  function updateActionButtons() {
    if (!selectedShip) return;
    const actionsTaken = selectedShip.actionsTakenThisTurn;
    const noActionsLeft = selectedShip.actionsLeft <= 0;

    document.getElementById("btn-fire").disabled =
      noActionsLeft || actionsTaken.includes("fire");
    document.getElementById("btn-accel").disabled =
      noActionsLeft ||
      actionsTaken.includes("speed") ||
      selectedShip.speed >= selectedShip.hp;
    document.getElementById("btn-decel").disabled =
      noActionsLeft ||
      actionsTaken.includes("speed") ||
      selectedShip.speed <= 1;
    document.getElementById("btn-turn-left").disabled =
      noActionsLeft && !actionsTaken.includes("turn");
    document.getElementById("btn-turn-right").disabled =
      noActionsLeft && !actionsTaken.includes("turn");
  }

  function updateUI() {
    if (gameState.winner) {
      gameStatusEl.textContent = `Player ${gameState.winner.id + 1} Won!`;
      return;
    }
    let statusText = "";
    switch (gameState.phase) {
      case "SETUP_ROLL":
        statusText = "Rolling for first player...";
        setTimeout(runSetup, 500);
        break;
      case "SETUP_PLACE_SHIP":
        statusText = `Player ${gameState.turn + 1}, place your ship.`;
        break;
      case "SETUP_PLACE_ASTEROID":
        statusText = `Player ${gameState.turn + 1}, place an asteroid.`;
        break;
      case "SETUP_ORIENT":
        statusText = `Player ${gameState.turn + 1}, choose orientation.`;
        if (!selectedShip || selectedShip.id !== gameState.turn) {
          selectShip(players.find((p) => p.id === gameState.turn));
        }
        break;
      case "ACTION":
        if (gameState.subPhase === "ORIENT_CHOICE")
          statusText = `Player ${gameState.turn + 1}, choose new orientation.`;
        else statusText = `Player ${gameState.turn + 1}'s Turn`;
        break;
      case "MOVEMENT":
        statusText = "Movement Phase";
        break;
    }
    gameStatusEl.textContent = statusText;
    if (selectedShip && gameState.phase === "ACTION")
      actionsLeftEl.textContent = selectedShip.actionsLeft;
    const pInfo = players
      .map((p) => {
        const data = p.container
          ? p
          : { id: p.id, hp: 6, speed: p.speed, asteroidsCaptured: 0 };
        const isTurn =
          (gameState.phase.includes("SETUP") || gameState.phase === "ACTION") &&
          data.id === gameState.turn;
        return `<div class="p-3 rounded ${isTurn ? "bg-cyan-900/50" : "bg-gray-700"}">
                        <h4 class="font-bold text-lg ${data.id === 0 ? "text-red-400" : "text-blue-400"}">Player ${data.id + 1}</h4>
                        <p>HP: ${data.hp} | Speed: ${data.speed}</p> <p>Asteroids: ${data.asteroidsCaptured}</p>
                    </div>`;
      })
      .join("");
    playerInfoEl.innerHTML = pInfo;
  }
  initGame();
})();
