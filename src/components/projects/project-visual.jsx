const labels = {
  compiler: ['source', 'LLVM IR', 'machine code'],
  network: ['capture', 'decode', 'inspect'],
  os: ['hardware', 'kernel', 'WebAssembly'],
  library: ['tensor', 'autograd', 'model'],
  sudoku: ['possibilities', 'constraints', 'solution'],
  engine: ['entities', 'components', 'systems'],
};

// Small code-native illustrations keep project browsing independent of large screenshots.
export default function ProjectVisual({ visual }) {
  const steps = labels[visual] || labels.compiler;
  return (
    <div className={`project-visual project-visual-${visual}`} aria-hidden="true">
      <div className="project-diagram">
        {steps.map((step, index) => (
          <div className="project-diagram-step" key={step}>
            <span className="project-diagram-symbol">{['{ }', '[ ]', '▸'][index]}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
