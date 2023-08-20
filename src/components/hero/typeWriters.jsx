import { useState, useEffect } from 'react';

const Typewriter = ({ text, delay }) => {
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

    const [done, setDone] = useState(false);

  useEffect(() => {
    let timeout;

    if (currentIndex < text.length) {
      timeout = setTimeout(() => {
        setCurrentText(prevText => prevText + text[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, delay);
    } else {
        setDone(true);
    }

    return () => clearTimeout(timeout);
  }, [currentIndex, delay, text]);

  return <span>{currentText} { !done && <span className='text-3xl text-purple-400'>_</span>} </span>;
};

export default Typewriter;
