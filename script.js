const { Engine, Render, World, Bodies, Events, Mouse, MouseConstraint, Constraint } = Matter;

const engine = Engine.create();
const world = engine.world;

// Set gravity
world.gravity.y = 0;

// Create white ball
const whiteBall = Bodies.circle(800, 300, 20, {
    friction: 0.005,
    restitution: 0.5,
    label: 'whiteBall',
    collisionFilter: {
        category: 2 // This sets the category of the whiteBall to 2
    },
    render: {
        fillStyle: 'white'
    }
});

// Create a constraint to control the white ball with a spring
const whiteBallSpring = Constraint.create({
    pointA: { x: whiteBall.position.x, y: whiteBall.position.y }, // Initial position of the constraint (center of the white ball)
    bodyB: whiteBall,
    stiffness: 0.05, // Stiffness of the spring (adjust as needed)
    length: 0, // Initial length of the spring (0 means the white ball is at rest)
    render: {
        visible: true, // Set this to true to make the constraint visible
        strokeStyle: 'white' // Set the stroke color of the constraint
    }
});

// HSLA Color randomizer
const randomHSLAColor = () => {
    const hue = Math.floor(Math.random() * 360); // Random hue value between 0 and 359
    const saturation = '100%'; // Full saturation
    const lightness = Math.floor(Math.random() * 50 + 30) + '%'; // Random lightness between 30% and 80%
    const alpha = 1; // Opacity (1 for fully opaque)

    return `hsla(${hue}, ${saturation}, ${lightness}, ${alpha})`;
};

// Create colored balls
const balls = [];
for (let i = 0; i < 5; i++) {
    const x = Math.random() * 480 + 490;
    const y = 460;
    const radius = 20;
    const ball = Bodies.circle(x, y, radius, {
        friction: 0.005,
        restitution: 0.5,
        label: 'colorBall',
        render: {
            fillStyle: randomHSLAColor()
        }
    });
    balls.push(ball);
}

// Create walls
const walls = [
    Bodies.rectangle(800, 700, 800, 50, { isStatic: true }), // Bottom wall
    Bodies.rectangle(800, 100, 800, 50, { isStatic: true }), // Top wall
    Bodies.rectangle(400, 400, 50, 660, { isStatic: true }), // Right wall
    Bodies.rectangle(1200, 400, 50, 660, { isStatic: true }) // Left wall
];

// Add balls and walls to the world
World.add(world, [whiteBall, whiteBallSpring, ...balls, ...walls]);

// Set up collision events
Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;
    pairs.forEach(function(pair) {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        if ((bodyA.label === 'ball' && bodyB.isStatic) || (bodyB.label === 'ball' && bodyA.isStatic)) {
            let ball;
            if (bodyA.label === 'ball') {
                ball = bodyA;
            } else {
                ball = bodyB;
            }

            // Calculate new velocity for the ball to simulate bouncing off the wall
            const restitution = 0.5; // Coefficient of restitution (bounciness)
            const normal = { x: pair.collision.normal.x, y: pair.collision.normal.y }; // Normal vector of collision
            const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
            const dotProduct = normal.x * ball.velocity.x + normal.y * ball.velocity.y;
            const impulse = -(1 + restitution) * dotProduct / (ball.inverseMass + 1 / ball.inverseMass);

            // Apply impulse to the ball to bounce off the wall
            Matter.Body.setVelocity(ball, { x: ball.velocity.x + impulse * normal.x, y: ball.velocity.y + impulse * normal.y });

            // Optional: You can add additional logic here if needed, such as playing a sound effect on collision
        }
    });
});

// Create hole
const holeRadius = 25; // Adjust the hole size as needed
const holePosition = { x: 800, y: 600 }; // Adjust the hole position as needed

const hole = Bodies.circle(holePosition.x, holePosition.y, holeRadius, {
    isStatic: true,
    isSensor: true,
    render: {
        fillStyle: 'black' // Color of the hole
    }
});

World.add(world, hole);

// Run the engine
Engine.run(engine);

// Create the renderer (assuming you have a canvas element in your HTML with id 'canvas')
let render = Render.create({
    element: document.body,
    canvas: canvas,
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        pixelRatio: window.devicePixelRatio
    }
});

const mouse = Mouse.create(render.canvas);

const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        render: {
            visible: false
        }
    }
});

// Add mouse constraint only to the whiteBall
mouseConstraint.collisionFilter = {
    category: 1, // a bit mask with a bit set for each category the object belongs to
    mask: 2 // the category of the other object(s) the object can collide with (in this case, the whiteBall will collide only with objects with category 2)
};

// Boolean used to toggle the constraint on the white ball
let isConstrained = true;

// Listen for mouse events to control the spring
Events.on(mouseConstraint, 'startdrag', function(event) {
    // When dragging starts, set the pointA of the spring to the current mouse position
    whiteBallSpring.pointA = { x: event.mouse.position.x, y: event.mouse.position.y };

    // Remove the spring constraint from the world
    World.add(world, whiteBallSpring);
});

Events.on(mouseConstraint, 'enddrag', function(event) {
    // Reset the pointA of the spring to the center of the white ball
    whiteBallSpring.pointA = { x: whiteBall.position.x, y: whiteBall.position.y };
    
    // When dragging ends, calculate the impulse based on the stretched distance
    const stretchedDistanceX = event.mouse.position.x - whiteBallSpring.pointA.x;
    const stretchedDistanceY = event.mouse.position.y - whiteBallSpring.pointA.y;
    
    // Calculate the magnitude of the impulse (force) to apply
    const impulseMagnitude = 0.01 * Math.sqrt(stretchedDistanceX ** 2 + stretchedDistanceY ** 2);

    // Calculate the angle of the stretched distance and apply the impulse in the opposite direction
    const angle = Math.atan2(stretchedDistanceY, stretchedDistanceX);
    const impulseX = -impulseMagnitude * Math.cos(angle);
    const impulseY = -impulseMagnitude * Math.sin(angle);

    // Apply impulse to the white ball
    Matter.Body.applyForce(whiteBall, whiteBall.position, { x: impulseX, y: impulseY });

    // Remove the spring constraint from the world
    World.remove(world, whiteBallSpring);
});

Events.on(engine, 'beforeUpdate', function(event) {
    // Damping factor (adjust as needed)
    const dampingFactor = 0.99;
    
    // Apply damping to the white ball's velocity
    whiteBall.velocity.x *= dampingFactor;
    whiteBall.velocity.y *= dampingFactor;
});

Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (pair.bodyA === hole) {
            removeBall(pair.bodyB);
        } else if (pair.bodyB === hole) {
            removeBall(pair.bodyA);
        }
    }
});

function removeBall(ball) {
    if (ball.label === 'colorBall' || ball.label === 'whiteBall') {
        World.remove(world, ball);
        // Check win condition or perform other actions when a ball is pocketed
    }
}

function removeConstraint() {
    // remove the constaint following a brief delay to have the ball move in the desired direction
    const timeoutID = setTimeout(() => {
      isConstrained = false;
      World.remove(world, whiteBallSpring);
      clearTimeout(timeoutID);
    }, 25);
  }

removeConstraint()

// Add mouseConstraint to the world
World.add(world, mouseConstraint);
render.mouse = mouse;

// Run the renderer
Render.run(render);
