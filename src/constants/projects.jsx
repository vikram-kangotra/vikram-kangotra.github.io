import { chinar, lamp, zenos, proto_rs, sudoku_solver, wirebyte } from '../assets';
const projects = [
  {
    name: 'Proto-rs',
    slug: 'proto-rs',
    category: 'Languages',
    label: 'COMPILER DESIGN',
    tags: ['Rust', 'LLVM'],
    description:
      'From source code to LLVM IR. A compiler built in Rust to explore how programming languages work underneath.',
    detail:
      'Proto-rs translates its own source language into LLVM Intermediate Representation, which can then be processed by the LLVM toolchain. An exploration of language implementation and the boundary between high-level ideas and machine execution.',
    href: 'https://github.com/vikram-kangotra/Proto-rs',
    imageSrc: proto_rs,
    visual: 'compiler',
  },
  {
    name: 'Wirebyte',
    slug: 'wirebyte',
    category: 'Systems',
    label: 'NETWORK ANALYSIS',
    tags: ['Rust', 'Networking'],
    description:
      'Making network traffic legible. A protocol analyzer for decoding packets and exploring what travels over the wire.',
    detail:
      'A network protocol analyzer written in Rust for adventurous purposes. Wirebyte explores packet decoding, traffic inspection, and the tools that make network monitoring and troubleshooting possible.',
    href: 'https://github.com/vikram-kangotra/Wirebyte',
    imageSrc: wirebyte,
    visual: 'network',
  },
  {
    name: 'ZenOS',
    slug: 'zenos',
    category: 'Systems',
    label: 'OPERATING SYSTEMS',
    tags: ['WebAssembly', 'Systems'],
    description:
      'An operating system with native WebAssembly support. An experiment in what a different foundation could look like.',
    detail:
      'ZenOS explores operating system design with WebAssembly as a native part of the system. A project driven by curiosity about runtimes and the foundations that applications depend on.',
    href: 'https://github.com/vikram-kangotra/ZenOS',
    imageSrc: zenos,
    visual: 'os',
  },
  {
    name: 'Lamp',
    slug: 'lamp',
    category: 'Libraries',
    label: 'MACHINE LEARNING',
    tags: ['Rust', 'Machine learning'],
    description:
      'Learning machine learning from the inside out. An educational, PyTorch-inspired library written in Rust.',
    detail:
      'Lamp is an attempt to build a PyTorch-like library in Rust for educational purposes. The goal is to learn how these libraries work by implementing the ideas, rather than competing with production frameworks.',
    href: 'https://github.com/vikram-kangotra/lamp',
    imageSrc: lamp,
    visual: 'library',
  },
  {
    name: 'Sudoku Solver',
    slug: 'sudoku-solver',
    category: 'Applications',
    label: 'DESKTOP APPLICATION',
    tags: ['GTK4', 'Algorithms'],
    description:
      'A native desktop take on a classic puzzle, powered by the Wave Function Collapse algorithm.',
    detail:
      'A GTK4 and libadwaita application that solves Sudoku using Wave Function Collapse. The project brings algorithm exploration together with a native Linux graphical interface.',
    href: 'https://gitlab.com/cyberphantom52/sudoku-solver',
    imageSrc: sudoku_solver,
    visual: 'sudoku',
  },
  {
    name: 'The Chinar Engine',
    slug: 'the-chinar-engine',
    category: 'Libraries',
    label: 'GAME DEVELOPMENT',
    tags: ['ECS', '2D / 3D'],
    description: 'An entity-component-system approach to building a 2D and 3D game engine.',
    detail:
      'The Chinar Engine explores an entity-component-system architecture for 2D and 3D game development, with a focus on the building blocks of a game engine.',
    href: 'https://github.com/vikram-kangotra/The-Chinar-Engine',
    imageSrc: chinar,
    visual: 'engine',
  },
];
export default projects;
