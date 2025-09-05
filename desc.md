For now unnamed.

Two player game. Ambient is "spaceships and asteroids".

The game is played in a 8x8 board, potentially a reused checkers/checkboard.

Playing the game requires 6-sided dies, 2 for the players (blue and red for example), and 3 more, brown. Also a paper or similar to write down hull strength later.

The game starts with both players choosing a color and rolling their dice. The largest roll gets first move, let's call it player 1. Both ships start with 6 points of hull strength. Hull strength is also 

Player 1 chooses where to place her dice, which represents a spaceship, in any unoccupied square in the board. Player 2 does likewise. The rolled number needs to be visible. If the number is lower than 3, it becomes 3.

Player 1 now rolls an asteroid dice and chooses where to place it. Player 2 does likewise, then Player 1. The die count represents the "hull" (strength, HP) of the asteroid. If the number is less than 3, it becomes 3.

Once all asteroids are placed, players choose what is the initial orientation of their ship. The number they have is their current speed, and orientation is one of the primary positions inside the square (N, W, S, E, NW, NE, etc). Can't be center. Once both have chosen, the first turn triggers, which moves (simultaneously) both ships in the direction they are facing.

Now, they alternate turns. In each turn they can take two actions, to choose from. Each of these can only be chosen once, i.e. you can't turn twice, or fire twice:
- fire in the direction they are facing
- accelerate or decelerate 1 point
- change direction, they can only change direction to the ones closest to the left and right to the one they have right now (i.e. 45 degree increments) unless their speed is 1,then any direction is valid.

If a player fires in a particular direction, the shot goes through the whole board, without wrap around. If it hits the other player, 1 point is substracted from its hull. If their speed is larger than its hull, it is reduced to match. If the shot hits an asteroid, the asteroid hull is reduced by 1. If the asteroid is destroyed, the player who destroyed it gets to keep it.

Once both actions are taken, the simulation advances and both ships move in the direction they are facing. They wrap around (as if in a torus) when passing through the boundary of the board. If they hit an asteroid, they lose the difference in hull (i.e. if the asteroid has hull 3 and the ship has hull 5, the ship ends with hull 2 and the player wins an asteroid). If the ship ends with 0 or negative hull, the player loses immediately.

The goal of the game is to either be the first to destroy 2 asteroids, or to destroy the enemy player.