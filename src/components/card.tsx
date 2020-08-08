import React, {CSSProperties, FunctionComponent, ReactNode} from "react";
import Img from "gatsby-image";
import styled from '@emotion/styled';
import {Link} from "gatsby";
import tw from "twin.macro";

export const StyledCard = styled(Link)`
  ${tw`block`}
  background-color: #fff;
  border-radius: 3px;
  box-shadow: 0 1px 1px #e6e6e6, 0 2px 4px #e6e6e6;
  transition: .5s all;
  overflow: hidden;

  &:hover {
    transform: translate3d(0, -5px, 0);
    box-shadow: 0 1px 1px #ccc, 0 4px 4px #ccc;
  }
`;

export const StyledArticle = styled.article`
  display: inline-block;
  width: 100%;
`;

export const FeaturedImage = styled(Img)`
`;

export const CardContent = styled.section<{ compact: boolean }>`
  ${props => props.compact ? tw`p-2` : tw`p-4`}
  p {
    ${tw`py-2`}
  }

  h2 {
    font-size: 1.2em;
  }
`;

export const CardMeta = styled.section`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: .8em;
  opacity: .8;
  line-height: 1em;
`;

export const CardTitle = styled.h2`
  margin: 0;
  padding: 0;
`;


export interface CardProps {
  title?: string;
  path: string;
  featuredImage?: any;
  content?: string;
  meta?: {
    time: string;
    timePretty: string;
    tag: string | null;
    timeToRead: number | null;
  };
  compact?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}

export const Card: FunctionComponent<CardProps> = ({
  title,
  meta,
  path,
  featuredImage,
  content,
  compact = false,
  style,
  children,
}) => (
  <StyledArticle style={style}>
    <StyledCard to={path}>
      
      {/* TODO: Oh boy... */}
      {(featuredImage && featuredImage.fixed) && <FeaturedImage fixed={featuredImage.fixed} /> }
      {(featuredImage && featuredImage.fluid) && <FeaturedImage fluid={featuredImage.fluid} /> }

      <CardContent compact={compact}>
        {children}
        <header>
          {meta &&
          <CardMeta>
            {meta.tag && <>{meta.tag}</>}
            {meta.time &&
            <time dateTime={meta.time}>{meta.timePretty}</time>
            }
          </CardMeta>
          }
          {title &&
          <CardTitle>{title}</CardTitle>
          }
        </header>
        {content &&
        <p dangerouslySetInnerHTML={{__html: content}}/>
        }
      </CardContent>
    </StyledCard>
  </StyledArticle>
);
