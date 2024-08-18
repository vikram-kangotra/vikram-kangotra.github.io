import {chinar, lamp, miosis, proto_rs, sudoku_solver, wirebyte} from "../assets";

const projects = [
    {
        name: "Proto-rs",
        description: "Proto-rs is a compiler written in Rust, utilizing LLVM as its backend. This compiler translates Proto-rs source code into LLVM Intermediate Representation (IR), which can then be further processed by the LLVM toolchain.",
        href: "https://github.com/vikram-kangotra/Proto-rs",
        imageSrc: proto_rs
    },
    {
        name: "Wirebyte",
        description: "A Network Protocol Analyzer written in Rust purely for adventurous purposes, offering a comprehensive network analysis tool designed for efficient monitoring and troubleshooting. With Wirebyte users can decode network traffic effortlessly, enabling seamless analysis and identification of potential issues.",
        href: "https://github.com/vikram-kangotra/Wirebyte",
        imageSrc: wirebyte
    },
    {
        name: "Sudoku Solver",
        description: "Sudoku Solver is a GTk4+libadwaita application that solves sudokus using the Wave Function Collapse Algorithm.",
        href: "https://gitlab.com/cyberphantom52/sudoku-solver",
        imageSrc: sudoku_solver
    },
    {
        name: "Lamp",
        description: "Lamp is an attempt to create a PyTorch-like library in Rust for educational purposes. It is not intended to rival the PyTorch library.",
        href: "https://github.com/vikram-kangotra/lamp",
        imageSrc: lamp
    },

    {
        name: "The Chinar Engine",
        description: "An ECS based 2D/3D Game Engine for fast game development process.",
        href: "https://github.com/vikram-kangotra/The-Chinar-Engine",
        imageSrc: chinar
    },
    {
        name: "Miosis",
        description: "A repository for my curious mind to understand OS Dev",
        href: "https://github.com/vikram-kangotra/Miosis",
        imageSrc: miosis
    },
]

export default projects;
