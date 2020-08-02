import React, {FunctionComponent} from "react";
import {MenuItem} from "../../utils/models";
import {FooterContainer, FooterMenuItem, FooterMenuLink, StyledFooter, StyledNav} from "./style";

interface FooterProps {
  menu: MenuItem[];
  owner: string;
}

const Footer: FunctionComponent<FooterProps> = ({menu, owner}) => (
  <StyledFooter>
    <FooterContainer>
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
          Deployed {process.env.HEAD}@{process.env.COMMIT_REF?.substring(0, 7)}
        </p>
      </div>
    </FooterContainer>
  </StyledFooter>
);

export default Footer;
