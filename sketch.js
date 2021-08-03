const UP = 0;
const DOWN = 1;
const RIGHT = 2;
const LEFT = 3; 
const FRONT = 4;
const BACK = 5;

const colors = [
    '#FFFFFF',
    '#FFFF00',
    '#FFA500',
    '#FF0000',
    '#00FF00',
    '#0000FF'
];

let cam;

const dim = 3;
const cube = [];

function setup() {
    createCanvas(windowWidth, windowHeight, WEBGL).elt.oncontextmenu = () => false;

    cam = createEasyCam({ distance: 400 });

    const len = 50;
    const offset = (dim-1)*len*0.5;

    for(let i=0; i<dim; ++i) {
        cube[i] = [];
        for(let j=0; j<dim; ++j) {
            cube[i][j] = [];
            for(let k=0; k<dim; ++k) {
                const x = len*i - offset;
                const y = len*j - offset;
                const z = len*k - offset;
                cube[i][j][k] = new Cubie(x,y,z,len);
            }
        }
    }
}

function draw() {
    background(51);
    for(let i=0; i<dim; ++i) {
        for(let j=0; j<dim; ++j) {
            for(let k=0; k<dim; ++k) {
                cube[i][j][k].show();
            }
        }
    }
}