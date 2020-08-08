import React, {FunctionComponent} from "react";
import StyledNavigation from "./navigation";
import reactStringReplace from 'react-string-replace';
import {MenuItem} from "../../utils/models";
import styled from '@emotion/styled';
import Typed from 'react-typed';

interface HeaderProps {
  title: string;
  description: string;
  topics: string[];
  menu: MenuItem[];
  search: boolean;
}

const StyledHeader = styled.header`
  display: flex;
  background: linear-gradient(-45deg,#7d96ae,#40556a) repeat scroll 0 0 transparent;
  flex-direction: column;
  border-bottom: 2px #ededed solid;
`;

const Description = styled.h2`
  margin: 0;
  opacity: .85;
`;

const StyledTopics = styled(Typed)`
  border-bottom: 3px #000 solid;
`;

const Header: FunctionComponent<HeaderProps> = ({title, description, menu, topics = [], search = true}) => {
  if (topics.length > 0) {
    description = reactStringReplace(description, '%TOPICS%', (match, i) => {
      return (
        <StyledTopics
          strings={topics}
          typeSpeed={70}
          backSpeed={90}
          shuffle={true}
          backDelay={1500}
          loop={true}
          key={match + i}
        />
      );
    }) as any;
  }

  return (
    <StyledHeader>
      <StyledNavigation title={title} menu={menu} showSearch={search}/>
      <div className="w-2/3 m-auto py-10">
          <Description>
            {description}
          </Description>
      </div>
    </StyledHeader>
  );
};

export default Header;
