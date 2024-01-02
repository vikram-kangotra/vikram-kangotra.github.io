import {chinar, miosis, proto_rs, sudoku_solver} from "../assets";

const projects = [
    {
        name: "Proto-rs",
        description: "Proto-rs is a compiler written in Rust, utilizing LLVM as its backend. This compiler translates Proto-rs source code into LLVM Intermediate Representation (IR), which can then be further processed by the LLVM toolchain.",
        href: "https://github.com/vikram-kangotra/Proto-rs",
        imageSrc: proto_rs
    },
    {
        name: "Miosis",
        description: "A repository for my curious mind to understand OS Dev",
        href: "https://github.com/vikram-kangotra/Miosis",
        imageSrc: miosis
    },
    {
        name: "The Chinar Engine",
        description: "An ECS based 2D/3D Game Engine for fast game development process.",
        href: "https://github.com/vikram-kangotra/The-Chinar-Engine",
        imageSrc: chinar
    },
    {
        name: "Sudoku Solver",
        description: "Sudoku Solver is a GTk4+libadwaita application that solves sudokus using the Wave Function Collapse Algorithm.",
        href: "https://gitlab.com/cyberphantom52/sudoku-solver",
        imageSrc: sudoku_solver
    }
]

export default projects;
