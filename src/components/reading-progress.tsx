import React, {FunctionComponent, RefObject, useEffect, useState} from "react";
import styled from '@emotion/styled';
import tw from "twin.macro";

interface ReadingProgressProps {
  target: RefObject<HTMLElement>;
}

const ReadingProgressBar = styled.div`
    ${tw`sticky inset-x-0 top-0 h-1 z-50 bg-teal-700`}
`;

const ReadingProgress: FunctionComponent<ReadingProgressProps> = ({target}) => {
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const scrollListener = () => {
    if (!target.current) {
      return;
    }

    const element = target.current;
    const startOfScroll = element.offsetTop - window.innerHeight;
    const windowScrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const relativeScrollPosition = windowScrollTop - window.innerHeight;
    const totalHeight = element.clientHeight;

    if (windowScrollTop < startOfScroll) {
      return setReadingProgress(0);
    }

    setReadingProgress((relativeScrollPosition / totalHeight) * 100);
  };

  useEffect(() => {
    window.addEventListener("scroll", scrollListener);
    return () => window.removeEventListener("scroll", scrollListener);
  });

  return (
    <ReadingProgressBar style={{width: `${readingProgress}%`}} />
  );
};

export default ReadingProgress;