import styled from '@emotion/styled'
import {Container} from "../common";
import {Link} from "gatsby";

export const StyledFooter = styled.footer`
  max-width: 100%;
  padding: 10px 0;
  z-index: 700;
  position: relative;
  font-size: .9em;
  margin-top: 50px;
`;

export const FooterContainer = styled(Container)`
  text-align: right;
  line-height: 1.1em;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const StyledNav = styled.nav`
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

export const FooterMenuItem = styled.a`
  color: #000;
  text-decoration: none;
`;

export const FooterMenuLink = styled(Link)`
  color: #000;
  text-decoration: none;
`;
