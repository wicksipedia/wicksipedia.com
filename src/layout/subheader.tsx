import React, {FunctionComponent} from "react";
import Img from "gatsby-image";
import styled from '@emotion/styled';
import {Container} from "../components/common";
import tw from "twin.macro";

interface SubheaderProps {
  title: string;
  subtitle?: string;
  image?: any;
}

const StyledSubheader = styled.div`
  ${tw`bg-black bg-opacity-50 mb-4`}
`;

const StyledContainer = styled(Container)`
  ${tw`flex flex-wrap py-4 px-2 md:px-0`}
`;

const SubheaderImage = styled(Img)`
  ${tw`mr-4`}
`;

const SubheaderTitle = styled.h1`
  ${tw`text-white font-bold text-xl my-auto mx-0`}
`;

const SubheaderSubtitle = styled.small`
  ${tw`block text-opacity-75`}
`;

const Subheader: FunctionComponent<SubheaderProps> = ({title, subtitle, image}) => (
  <StyledSubheader>
    <StyledContainer>
      {image && <SubheaderImage fixed={image.fixed}/>}
      <SubheaderTitle>
        {title}
        <SubheaderSubtitle>{subtitle}</SubheaderSubtitle>
      </SubheaderTitle>
    </StyledContainer>
  </StyledSubheader>
);

export default Subheader;
