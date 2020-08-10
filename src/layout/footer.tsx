import React, {FunctionComponent} from "react";
import {MenuItem} from "../utils/models";
import styled from '@emotion/styled'
import {Container} from "../components/common";
import {Link} from "gatsby";
import { OutboundLink } from "gatsby-plugin-google-analytics";

const StyledFooter = styled.footer`
  max-width: 100%;
  padding: 10px 0;
  z-index: 700;
  position: relative;
  font-size: .9em;
  margin-top: 50px;
`;

const FooterContainer = styled(Container)`
  text-align: right;
  line-height: 1.1em;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StyledNav = styled.nav`
  ul {
    list-style-type: none;
    margin: 0;
    padding: 0;
  }

  li {
    display: inline-block;
    margin-right: 25px;

    &:last-child {
      margin-right: 0;
    }
  }
`;

const FooterMenuItem = styled.a`
  color: #000;
  text-decoration: none;
`;

const FooterMenuLink = styled(Link)`
  color: #000;
  text-decoration: none;
`;

interface FooterProps {
  menu: MenuItem[];
  owner: string;
}

const Footer: FunctionComponent<FooterProps> = ({menu, owner}) => (
  <StyledFooter>
    <FooterContainer className="p-2">
      <StyledNav>
        <ul>
          {menu.map((item, index) => (
            <li key={index}>
              {/* Links to RSS and Sitemap are handled
                  differently (for now) since they're technically external links */}
              {['/rss.xml', '/sitemap.xml'].indexOf(item.path) >= 0
                ? <FooterMenuItem href={item.path} rel={`noopener noreferrer`}>{item.name}</FooterMenuItem>
                : <FooterMenuLink to={item.path}>{item.name}</FooterMenuLink>
              }
            </li>
          ))}
        </ul>
      </StyledNav>
      <div>
        <p className='m-0'>
          <strong>{owner}</strong>&nbsp;&copy; {new Date().getFullYear()}
        </p>
        <p className="m-0 opacity-75 text-xs">
          Deployed <OutboundLink href={`https://github.com/wicksipedia/wicksipedia.com/commit/${process.env.COMMIT_REF?.substring(0, 7)}`}>{process.env.HEAD}@{process.env.COMMIT_REF?.substring(0, 7)}</OutboundLink>
        </p>
      </div>
    </FooterContainer>
  </StyledFooter>
);

export default Footer;
