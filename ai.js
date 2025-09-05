// ai.js
const AI = {
  _boardSize: 8,
  _directions: [
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: -1 },
    { x: -1, y: -1 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],

  // --- HELPERS ---

  isOccupied(x, y, players, asteroids) {
    const allObjects = players.filter((p) => p.container).concat(asteroids);
    return allObjects.some((c) => c.x === x && c.y === y);
  },

  getShotTarget(shooter, players, asteroids) {
    const dir = this._directions[shooter.orientation];
    for (let i = 1; i < this._boardSize; i++) {
      const checkX = shooter.x + dir.x * i;
      const checkY = shooter.y + dir.y * i;
      if (
        checkX < 0 ||
        checkX >= this._boardSize ||
        checkY < 0 ||
        checkY >= this._boardSize
      )
        break;
      const otherPlayer = players.find(
        (p) => p.id !== shooter.id && p.x === checkX && p.y === checkY,
      );
      if (otherPlayer) return { type: "player", object: otherPlayer };
      const asteroid = asteroids.find((a) => a.x === checkX && a.y === checkY);
      if (asteroid) return { type: "asteroid", object: asteroid };
    }
    return null;
  },

  // --- SETUP PHASE LOGIC ---

  getBestPlacement(players, asteroids) {
    let x, y;
    do {
      x = 1 + Math.floor(Math.random() * (this._boardSize - 2));
      y = 1 + Math.floor(Math.random() * (this._boardSize - 2));
    } while (this.isOccupied(x, y, players, asteroids));
    return { x, y };
  },

  getBestOrientation(aiPlayer, target) {
    const dx = target.x - aiPlayer.x;
    const dy = target.y - aiPlayer.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const angleMap = [
      { angle: 0, dir: 0 },
      { angle: -45, dir: 1 },
      { angle: -90, dir: 2 },
      { angle: -135, dir: 3 },
      { angle: 180, dir: 4 },
      { angle: -180, dir: 4 },
      { angle: 135, dir: 5 },
      { angle: 90, dir: 6 },
      { angle: 45, dir: 7 },
    ];
    let bestDir = 0,
      minDiff = 360;
    angleMap.forEach((map) => {
      let diff = Math.abs(angle - map.angle);
      if (diff > 180) diff = 360 - diff;
      if (diff < minDiff) {
        minDiff = diff;
        bestDir = map.dir;
      }
    });
    return bestDir;
  },

  // --- ACTION PHASE LOGIC ---

  getBestActions(aiPlayer, humanPlayer, players, asteroids) {
    let actions = [];
    let typesUsed = [];
    const addAction = (action) => {
      const type = action.includes("turn")
        ? "turn"
        : action.includes("celerate")
          ? "speed"
          : "fire";
      if (actions.length < 2 && !typesUsed.includes(type)) {
        actions.push(action);
        typesUsed.push(type);
      }
    };

    const shot = this.getShotTarget(aiPlayer, players, asteroids);
    if (shot && shot.type === "player") addAction("fire");

    const humanShot = this.getShotTarget(humanPlayer, players, asteroids);
    if (
      humanShot &&
      humanShot.type === "player" &&
      humanShot.object.id === aiPlayer.id
    ) {
      addAction("turnRight");
      if (aiPlayer.speed < aiPlayer.hp && aiPlayer.speed < 6)
        addAction("accelerate");
    }

    if (shot && shot.type === "asteroid") addAction("fire");

    const desiredOrientation = this.getBestOrientation(aiPlayer, humanPlayer);
    if (aiPlayer.orientation !== desiredOrientation) addAction("turnLeft");

    if (aiPlayer.speed < aiPlayer.hp && aiPlayer.speed < 6)
      addAction("accelerate");

    if (actions.length < 2) addAction("decelerate");
    if (actions.length < 2) addAction("turnRight");
    if (actions.length < 2) addAction("fire");

    return actions.slice(0, 2);
  },
};
