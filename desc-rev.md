# Roll-for-Laser

### Game Overview
A two-player tactical game of spaceship combat on an 8x8 grid. Players maneuver their ships to destroy their opponent or be the first to capture two asteroids.

### Components
* 1 8x8 board
* 2 player dice (distinguishable colors, e.g., blue and red) representing ships.
* 3 neutral dice (e.g., brown) representing asteroids.
* A method for tracking Hull Points (paper and pencil).

### Core Ship Rules
* **Hull Points (HP)**: A ship's health. Starts at 6. If it reaches 0, the ship is destroyed.
* **Speed**: A ship's velocity, represented by the number facing up on its die (pips). The minimum Speed is 1.
* **The Golden Rule**: A ship's **Speed cannot exceed its current HP**.
    * If damage causes HP to drop below the current Speed, the Speed is immediately reduced to match the new HP.
    * A player cannot choose to accelerate if their Speed is already equal to their HP.

### Setup
1.  **Choose Colors**: Each player chooses a ship color. Both ships start with **6 HP**.
2.  **Determine First Player**: Each player rolls their die. The higher roll goes first. Keep rolling on ties.
3.  **Set Initial Speed**: The number rolled becomes the ship's initial **Speed**. If the roll is less than 3, the Speed is set to 3. Place the die on the board with this number facing up.
4.  **Place Ships**: The first player places their ship on any empty square. The second player does the same.
5.  **Place Asteroids**: Starting with the first player, players alternate placing the three asteroids. For each, roll a die and place it on any empty square. The number rolled is the asteroid's **Hull**. If the roll is less than 3, its Hull is set to 3.
6.  **Set Initial Orientation**: Player 1 chooses an orientation for their ship (N, NE, E, SE, S, SW, W, or NW), then player 2 does.

### Winning the Game
You win by achieving one of the following conditions:
* Destroy the enemy ship (reduce its HP to 0 or less).
* Be the first to capture two asteroids.
* Force a Ship vs. Ship collision while having more HP than the opponent.

### Gameplay
Players alternate turns. A full round consists of Player 1's turn, followed by Player 2's turn, and then a simultaneous Movement Phase.

1.  **Action Phase (Player's Turn)**: The current player performs **two** actions. They can't be the same action.
    * **Fire**: Shoots a laser in the ship's current direction. The beam travels across the entire board in a straight line (no wrap-around).
    * **Accelerate/Decelerate**: Increase or decrease Speed by 1 (updating the die face). Remember the Golden Rule.
    * **Turn**: Change orientation by 45° (e.g., from N to NE or NW). **Exception**: If Speed is 1, you may turn to any of the 8 orientations.

2.  **Movement Phase**: After **both** players have taken their turns, their ships move simultaneously. The number of squares moved is equal to `ceil(Speed / 2)`.
    * Speed 1 or 2: Move 1 square.
    * Speed 3 or 4: Move 2 squares.
    * Speed 5 or 6: Move 3 squares.
    Board edges wrap around (torus).

### Combat and Collisions
* **Laser vs. Ship**: If a laser hits the enemy ship, the target loses 1 HP. Its Speed is then adjusted to not exceed its new HP, if necessary.
* **Laser vs. Asteroid**: If a laser hits an asteroid, the asteroid loses 1 Hull. If its Hull reaches 0, the firing player captures it.
* **Ship vs. Asteroid Collision**: If a ship's movement path intersects an asteroid, the ship will hit it. The following happens in order:
    1.  The ship's new HP becomes `Current HP - Asteroid's Hull`. If HP is 0 or less, the player loses immediately.
    2.  The ship's Speed is reduced by 1.
    3.  The Golden Rule is enforced: Speed is adjusted down to the new HP, if necessary. Direction is kept.
    4.  The player captures the destroyed asteroid.
* **Ship vs. Ship Collision**: If two ships move to the same square during the end of the simulated step or face directly one another and the simulation makes them cross:
    * If one ship has higher HP, its player wins the game immediately. The other ship is destroyed.
    * If both ships have the exact same HP, they miraculously avoid collision and nothing happens. They pass through in their expected trajectories.