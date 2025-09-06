// --- CONFIG ---
const BOARD_SIZE = 8;
const ORIGINAL_CELL_SIZE = 60; // Base size for scaling calculations
let CELL_SIZE = 60; // This will be updated dynamically
const GRID_COLOR = 0x00ffff;
const SHIP_COLORS = [0xff4444, 0x4444ff]; // Red, Blue

// --- PIXI APP SETUP ---
const canvasContainer = document.getElementById("pixi-canvas");

(async () => {
  const app = new PIXI.Application();
  await app.init({
    backgroundColor: 0x111827,
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
  const p1InfoTopEl = document.getElementById("p1-info-top");
  const p2InfoTopEl = document.getElementById("p2-info-top");
  const actionsPanelEl = document.getElementById("actions-panel");
  const orientationPanelEl = document.getElementById("orientation-panel");
  const orientationTitleEl = document.getElementById("orientation-title");
  const actionsLeftEl = document.getElementById("actions-left");
  const winnerModalEl = document.getElementById("winner-modal");
  const winnerTextEl = document.getElementById("winner-text");
  const gameSetupModalEl = document.getElementById("game-setup-modal");

  // --- RESIZE LOGIC ---
  let grid; // To hold the grid graphics object
  function redrawAll() {
    if (!grid) return;
    grid.clear();

    for (let i = 0; i <= BOARD_SIZE; i++) {
      grid
        .moveTo(i * CELL_SIZE, 0)
        .lineTo(i * CELL_SIZE, BOARD_SIZE * CELL_SIZE);
      grid
        .moveTo(0, i * CELL_SIZE)
        .lineTo(BOARD_SIZE * CELL_SIZE, i * CELL_SIZE);
    }
    grid.stroke({ color: GRID_COLOR, alpha: 0.2, width: 1 });
    const allObjects = (players || []).concat(asteroids || []);
    allObjects.forEach((obj) => {
      if (obj && obj.container && !obj.container.destroyed) {
        const newScale = CELL_SIZE / ORIGINAL_CELL_SIZE;
        obj.container.x = obj.x * CELL_SIZE + CELL_SIZE / 2;
        obj.container.y = obj.y * CELL_SIZE + CELL_SIZE / 2;
        obj.container.scale.set(newScale);
      }
    });
  }

  function resizeCanvas() {
    const topBar = document.querySelector(".top-bar");
    const actionsContainer = document.querySelector(".actions-container");
    const gameWrapper = document.querySelector(".game-wrapper");

    // Calculate total height of fixed UI elements
    const uiHeight = topBar.offsetHeight + actionsContainer.offsetHeight;
    const verticalGap = 16; // 1rem gap

    const availableHeight =
      gameWrapper.clientHeight - uiHeight - verticalGap * 2;
    const availableWidth = gameWrapper.clientWidth;

    const canvasSize = Math.floor(Math.min(availableHeight, availableWidth));

    if (canvasSize <= 0 || !app.renderer) return;

    app.renderer.resize(canvasSize, canvasSize);
    // Center the canvas view (important if canvas is smaller than container)
    app.view.style.width = `${canvasSize}px`;
    app.view.style.height = `${canvasSize}px`;

    CELL_SIZE = canvasSize / BOARD_SIZE;
    redrawAll();
  }
  window.addEventListener("resize", resizeCanvas);

  // --- GAME STATE & OTHER VARIABLES ---
  let gameMode = "human";
  const AI_PLAYER_ID = 1;
  let gameState;
  let players;
  let asteroids;
  let selectedShip = null;

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
    if (selectedShip && gameState.phase === "ACTION") endPlayerTurn();
  });
  document.getElementById("btn-restart").addEventListener("click", () => {
    winnerModalEl.classList.add("hidden");
    gameSetupModalEl.classList.remove("hidden");
    app.stage.removeChildren();
  });
  document.querySelectorAll(".orient-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const orient = parseInt(e.target.dataset.orient);
      if (gameState.phase === "SETUP_ORIENT") handleAction("orient", orient);
      else if (
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
  document.getElementById("btn-vs-human").addEventListener("click", () => {
    gameMode = "human";
    gameSetupModalEl.classList.add("hidden");
    initGame();
  });
  document.getElementById("btn-vs-ai").addEventListener("click", () => {
    gameMode = "ai";
    gameSetupModalEl.classList.add("hidden");
    initGame();
  });
  document
    .getElementById("btn-rules")
    .addEventListener("click", () =>
      showRules("rules-modal", "rules-content", "rules.md"),
    );
  document.getElementById("btn-close-rules").addEventListener("click", () => {
    document.getElementById("rules-modal").classList.add("hidden");
  });

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
      if (this.life <= this.maxLife / 2)
        this.alpha = this.life / (this.maxLife / 2);
      else if (this.life > this.maxLife / 2 && this.life <= this.maxLife)
        this.alpha = (this.maxLife - this.life) / (this.maxLife / 2);
      else {
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
      hpText: null,
      speedText: null,
      shapeData: null,
      orientationAtTurnStart: 0,
      turnDelta: 0,
    };
    ship.container = new PIXI.Container();
    const lynxVertices = [
      [-70, 50],
      [70, 0],
      [-70, -50],
      [-30, 0],
      [-70, 50],
    ];
    const scale = ORIGINAL_CELL_SIZE / 180;
    ship.shapeData = lynxVertices.flat().map((v) => v * scale);
    const body = new PIXI.Graphics()
      .poly(ship.shapeData)
      .fill({ color: SHIP_COLORS[id] });
    const border = new PIXI.Graphics();
    border.name = "border";
    const hpTextStyle = new PIXI.TextStyle({
      fill: "#67e8f9",
      fontSize: 28,
      fontWeight: "bold",
      stroke: { color: "#000000", width: 5, join: "round" },
    });
    const speedTextStyle = new PIXI.TextStyle({
      fill: "#ffffff",
      fontSize: 22,
      fontWeight: "bold",
      stroke: { color: "#000000", width: 4, join: "round" },
    });
    ship.hpText = new PIXI.Text({ text: String(ship.hp), style: hpTextStyle });
    ship.hpText.anchor.set(0.5);
    ship.speedText = new PIXI.Text({
      text: String(ship.speed),
      style: speedTextStyle,
    });
    ship.speedText.anchor.set(0.5);
    ship.speedText.x = -ORIGINAL_CELL_SIZE * 0.25;
    ship.container.addChild(body, ship.hpText, ship.speedText, border);
    app.stage.addChild(ship.container);
    ship.container.eventMode = "static";
    ship.container.cursor = "pointer";
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
    const vertices = generateAsteroidVertices(ORIGINAL_CELL_SIZE / 2.5, 9);
    const body = new PIXI.Graphics().poly(vertices.flat()).fill(0x964b00);
    const textStyle = new PIXI.TextStyle({
      fill: "white",
      fontSize: 20,
      fontWeight: "bold",
    });
    asteroid.text = new PIXI.Text({
      text: String(asteroid.hp),
      style: textStyle,
    });
    asteroid.text.anchor.set(0.5);
    asteroid.container.addChild(body, asteroid.text);
    app.stage.addChild(asteroid.container);
    return asteroid;
  }
  function showDamageEffect(targetShip) {
    const shipBody = targetShip.container.children[0];
    shipBody.tint = 0xff0000;
    setTimeout(() => {
      shipBody.tint = 0xffffff;
    }, 300);
    const damageTextStyle = new PIXI.TextStyle({
      fill: "#ff4d4d",
      fontSize: 28,
      fontWeight: "bold",
      stroke: { color: "white", width: 5 },
    });
    const damageText = new PIXI.Text({ text: "-1", style: damageTextStyle });
    damageText.anchor.set(0.5);
    damageText.x = targetShip.container.x;
    damageText.y = targetShip.container.y - CELL_SIZE / 2;
    app.stage.addChild(damageText);
    let life = 60;
    const tickerCallback = () => {
      damageText.y -= 0.75;
      damageText.alpha = life / 60;
      life--;
      if (life <= 0) {
        app.ticker.remove(tickerCallback);
        damageText.destroy();
      }
    };
    app.ticker.add(tickerCallback);
  }
  function updateShipGraphics(ship) {
    if (!ship || !ship.container || ship.container.destroyed) return;
    ship.hpText.text = String(ship.hp);
    ship.speedText.text = String(ship.speed);
    ship.container.rotation =
      directionAngle[ship.orientation] * (Math.PI / 180);
    ship.hpText.rotation = -ship.container.rotation;
    ship.speedText.rotation = -ship.container.rotation;
    updateUI();
  }
  function isOccupied(x, y, objects) {
    return objects.some((c) => c.x === x && c.y === y);
  }
  function initGame() {
    app.stage.removeChildren();
    grid = new PIXI.Graphics();
    app.stage.addChild(grid); // Store grid globally
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
    // Use requestAnimationFrame to ensure layout is calculated before resizing
    requestAnimationFrame(() => {
      resizeCanvas();
      runSetup();
    });
  }
  function handleCanvasClick(event) {
    if (gameMode === "ai" && gameState.turn === AI_PLAYER_ID) return;
    const x = Math.floor(event.global.x / CELL_SIZE);
    const y = Math.floor(event.global.y / CELL_SIZE);
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return;
    if (gameState.phase.startsWith("SETUP_PLACE_")) {
      if (!isOccupied(x, y, players.concat(asteroids))) runSetup(x, y);
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
        if (gameState.setupSubPhase === 2) startTurn(gameState.firstMoverId);
        break;
    }
    updateUI();
    redrawAll(); // Redraw after setup changes
    if (
      gameMode === "ai" &&
      gameState.turn === AI_PLAYER_ID &&
      !gameState.winner &&
      gameState.phase.startsWith("SETUP_")
    )
      setTimeout(runAITurn, 1000);
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
    selectShip(currentPlayer);
    updateUI();
    if (gameMode === "ai" && playerId === AI_PLAYER_ID && !gameState.winner)
      setTimeout(runAITurn, 1000);
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async function runAITurn() {
    if (
      gameState.winner ||
      gameMode !== "ai" ||
      gameState.turn !== AI_PLAYER_ID
    )
      return;
    deselectAll();
    const aiPlayer = players.find((p) => p.id === AI_PLAYER_ID);
    if (aiPlayer?.container) selectShip(aiPlayer);
    await sleep(800);
    switch (gameState.phase) {
      case "SETUP_PLACE_SHIP":
      case "SETUP_PLACE_ASTEROID": {
        const { x, y } = AI.getBestPlacement(players, asteroids);
        runSetup(x, y);
        break;
      }
      case "SETUP_ORIENT": {
        const humanPlayer = players.find((p) => p.id !== AI_PLAYER_ID);
        const orientation = AI.getBestOrientation(aiPlayer, humanPlayer);
        aiPlayer.orientation = orientation;
        updateShipGraphics(aiPlayer);
        await sleep(500);
        runSetup();
        break;
      }
      case "ACTION": {
        const humanPlayer = players.find((p) => p.id !== AI_PLAYER_ID);
        const actions = AI.getBestActions(
          aiPlayer,
          humanPlayer,
          players,
          asteroids,
        );
        for (const action of actions) {
          if (selectedShip?.id !== AI_PLAYER_ID) selectShip(aiPlayer);
          await handleAction(action);
          await sleep(600);
        }
        await sleep(500);
        if (gameState.phase === "ACTION") endPlayerTurn();
        break;
      }
    }
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
            updateShipGraphics(ship);
          }
          break;
        case "decelerate":
          if (isFirstActionOfType && ship.actionsLeft > 0 && ship.speed > 1) {
            ship.actionsLeft--;
            ship.actionsTakenThisTurn.push(typeKey);
            ship.speed--;
            updateShipGraphics(ship);
          }
          break;
        case "turnLeft":
          if (ship.speed === 1) {
            // Allow re-orienting if the 'turn' action has already been used this turn
            if (
              (isFirstActionOfType && ship.actionsLeft > 0) ||
              ship.actionsTakenThisTurn.includes("turn")
            ) {
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
            // Allow re-orienting if the 'turn' action has already been used this turn
            if (
              (isFirstActionOfType && ship.actionsLeft > 0) ||
              ship.actionsTakenThisTurn.includes("turn")
            ) {
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
      selectedShip.orientation = value;
      runSetup();
    }
    updateShipGraphics(ship);
  }
  function endPlayerTurn() {
    const secondMoverId = 1 - gameState.firstMoverId;
    if (gameState.turn === gameState.firstMoverId) startTurn(secondMoverId);
    else startMovementPhase();
  }
  async function fireLaser(ship) {
    const shipAngleRad = directionAngle[ship.orientation] * (Math.PI / 180);
    const tipOffset = CELL_SIZE / 2.5;
    const startX = ship.container.x + Math.cos(shipAngleRad) * tipOffset;
    const startY = ship.container.y + Math.sin(shipAngleRad) * tipOffset;

    // Create muzzle flash effect
    for (let i = 0; i < 5; i++) {
      app.stage.addChild(
        new FireParticle(SHIP_COLORS[ship.id], startX, startY, shipAngleRad),
      );
    }

    // --- MODIFICATION START ---

    let laserLength = BOARD_SIZE * CELL_SIZE * 1.5; // Default max length
    let collisionTarget = null;
    let collisionType = null;

    // 1. Find the first object in the line of fire
    for (let i = 1; i < BOARD_SIZE * 2; i++) {
      const checkX = ship.x + directions[ship.orientation].x * i;
      const checkY = ship.y + directions[ship.orientation].y * i;

      // Stop if the check goes off the board
      if (
        checkX < 0 ||
        checkX >= BOARD_SIZE ||
        checkY < 0 ||
        checkY >= BOARD_SIZE
      ) {
        break;
      }

      const otherPlayer = players.find(
        (p) => p.id !== ship.id && p.x === checkX && p.y === checkY,
      );
      if (otherPlayer) {
        collisionTarget = otherPlayer;
        collisionType = "player";
        break;
      }

      const asteroid = asteroids.find((a) => a.x === checkX && a.y === checkY);
      if (asteroid) {
        collisionTarget = asteroid;
        collisionType = "asteroid";
        break;
      }
    }

    // 2. If an object was found, calculate the precise length to its center
    if (collisionTarget) {
      const endX = collisionTarget.x * CELL_SIZE + CELL_SIZE / 2;
      const endY = collisionTarget.y * CELL_SIZE + CELL_SIZE / 2;
      const dx = endX - startX;
      const dy = endY - startY;
      laserLength = Math.sqrt(dx * dx + dy * dy);
    }

    // 3. Create the laser beam with the correct length
    app.stage.addChild(
      new LaserBeam(
        SHIP_COLORS[ship.id],
        startX,
        startY,
        shipAngleRad,
        laserLength, // Use the calculated length
        3,
      ),
    );

    // 4. Apply damage to the found target
    if (collisionTarget) {
      if (collisionType === "player") {
        collisionTarget.hp--;
        showDamageEffect(collisionTarget);
        enforceGoldenRule(collisionTarget);
        updateShipGraphics(collisionTarget);
      } else if (collisionType === "asteroid") {
        collisionTarget.hp--;
        collisionTarget.text.text = String(collisionTarget.hp);
        if (collisionTarget.hp <= 0) {
          captureAsteroid(ship, collisionTarget);
        }
      }
    }
    // --- MODIFICATION END ---

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
        endGame(p1, "Won a Ship Collision");
        return;
      }
      if (p2.hp > p1.hp) {
        endGame(p2, "Won a Ship Collision");
        return;
      }
      if (p1.hp === p2.hp) p1.isPhasing = p2.isPhasing = true;
    }
    for (const move of moves) {
      let stopped = false;
      for (const pos of move.path) {
        const asteroid = asteroids.find((a) => a.x === pos.x && a.y === pos.y);
        if (asteroid) {
          move.player.hp -= asteroid.hp;
          showDamageEffect(move.player);
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
        if (!gameState.winner) startTurn(gameState.firstMoverId);
      }
    };
    ticker.add(animation);
  }
  function checkWinConditions() {
    if (gameState.winner) return;
    players.forEach((p) => {
      if (p.hp <= 0)
        endGame(
          players.find((winner) => winner.id !== p.id),
          "Enemy Ship Destroyed",
        );
      if (p.asteroidsCaptured >= 2) endGame(p, "Captured Two Asteroids");
    });
  }
  function endGame(winner, reason) {
    if (gameState.winner || !winner) return;
    gameState.winner = winner;
    const reasonText = reason
      ? `<br><span style="font-size: 1.5rem; color: #ccc; font-weight: normal;">${reason}</span>`
      : "";
    winnerTextEl.innerHTML = `Player ${winner.id + 1} Wins!${reasonText}`;
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
    //if (showSetupOrient) orientationTitleEl.textContent = "Set Orientation";
    //if (showActionOrient) orientationTitleEl.textContent = "Re-orient Ship";
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
        break;
      case "SETUP_PLACE_SHIP":
        statusText = `Player ${gameState.turn + 1}, place your ship.`;
        break;
      case "SETUP_PLACE_ASTEROID":
        statusText = `Player ${gameState.turn + 1}, place an asteroid.`;
        break;
      case "SETUP_ORIENT":
        statusText = `Player ${gameState.turn + 1}, choose orientation.`;
        if (!selectedShip || selectedShip.id !== gameState.turn)
          selectShip(players.find((p) => p.id === gameState.turn));
        break;
      case "ACTION":
        statusText =
          gameState.subPhase === "ORIENT_CHOICE"
            ? `Player ${gameState.turn + 1}, re-orient.`
            : `Player ${gameState.turn + 1}'s Turn`;
        break;
      case "MOVEMENT":
        statusText = "Movement Phase";
        break;
    }
    gameStatusEl.textContent = statusText;
    if (selectedShip && gameState.phase === "ACTION")
      gameStatusEl.textContent += ` (${selectedShip.actionsLeft}/2)`;
    const pData = [0, 1].map((id) => {
      let p = players.find((player) => player.id === id && player.container);
      if (p)
        return {
          hp: p.hp,
          speed: p.speed,
          asteroidsCaptured: p.asteroidsCaptured,
        };
      let placeholder = players.find((pl) => pl.id === id);
      return {
        hp: 6,
        speed: placeholder ? placeholder.speed : "?",
        asteroidsCaptured: 0,
      };
    });
    p1InfoTopEl.innerHTML = `P1 &nbsp; ❤️ ${pData[0].hp} &nbsp; ⚡️ ${pData[0].speed} &nbsp; ☄️ ${pData[0].asteroidsCaptured}`;
    p2InfoTopEl.innerHTML = `P2 &nbsp; ❤️ ${pData[1].hp} &nbsp; ⚡️ ${pData[1].speed} &nbsp; ☄️ ${pData[1].asteroidsCaptured}`;
    const isTurnPhase =
      gameState.phase.includes("SETUP") || gameState.phase === "ACTION";
    p1InfoTopEl.classList.toggle("active", isTurnPhase && gameState.turn === 0);
    p2InfoTopEl.classList.toggle("active", isTurnPhase && gameState.turn === 1);
  }
})();
