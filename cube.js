class Cubie {
    constructor(x,y,z,len_) {
        this.pos = createVector(x,y,z,len_);
        this.len = len_;
    }

    show() {
        fill(255);
        stroke(0);
        strokeWeight(8);
        push();
        translate(this.pos.x,this.pos.y, this.pos.z);
        const r = this.len/2;

        beginShape();
        fill(colors[BACK]);
        vertex(-r,-r,-r);
        vertex(r,-r,-r);
        vertex(r,r,-r);
        vertex(-r,r,-r);
        endShape(CLOSE);

        beginShape();
        fill(colors[FRONT]);
        vertex(-r, -r, r);
        vertex(r, -r, r);
        vertex(r, r, r);
        vertex(-r, r, r);
        endShape(CLOSE);

        beginShape();
        fill(colors[DOWN]);
        vertex(-r, -r, -r);
        vertex(r, -r, -r);
        vertex(r, -r, r);
        vertex(-r, -r, r);
        endShape(CLOSE);

        beginShape();
        fill(colors[UP]);
        vertex(-r, r, -r);
        vertex(r, r, -r);
        vertex(r, r, r);
        vertex(-r, r, r);
        endShape(CLOSE);

        beginShape();
        fill(colors[LEFT]);
        vertex(-r, -r, -r);
        vertex(-r, r, -r);
        vertex(-r, r, r);
        vertex(-r, -r, r);
        endShape(CLOSE);

        beginShape();
        fill(colors[RIGHT]);
        vertex(r, -r, -r);
        vertex(r, r, -r);
        vertex(r, r, r);
        vertex(r, -r, r);
        endShape(CLOSE);

        pop();
    }
}