import React, {CSSProperties, FunctionComponent} from "react";
import styled from '@emotion/styled';
import {graphql, useStaticQuery} from "gatsby";
import Img from "gatsby-image";
import tw from "twin.macro";

interface AvatarProps {
  alt: string;
  style?: CSSProperties;
}

const AvatarImage = styled(Img)`
`;

const Avatar: FunctionComponent<AvatarProps> = ({alt, style}) => {
  const logo = useStaticQuery(graphql`
    query {
      file(sourceInstanceName: {eq: "assets"}, name: {eq: "avatar"}) {
        childImageSharp {
          fixed(width: 55, height: 55) {
            ...GatsbyImageSharpFixed
          }
        }
      }
    }
  `);

  return <AvatarImage
    fixed={logo.file.childImageSharp.fixed}
    alt={alt}
    style={style} />;
};

export default Avatar;
