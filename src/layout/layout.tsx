import React, {FunctionComponent, ReactNode} from "react";
import {graphql, useStaticQuery} from "gatsby";
import Header from "./header";
import {SiteMetadata} from "../utils/models";
import Navigation from "./header/navigation";
import Footer from "./footer";
import styled from '@emotion/styled';

interface LayoutProps {
  children: ReactNode;
  bigHeader?: boolean;
}

const Main = styled.main`
  min-height: 80vh;
`;

const Layout: FunctionComponent<LayoutProps> = ({children, bigHeader = true}) => {
  const data = useStaticQuery<SiteMetadata>(graphql`
    query {
      site {
        siteMetadata {
          title
          description
          topics
          menu {
            name
            path
          }
          footerMenu {
            name
            path
          }
          search
        }
      }
    }
  `);

  return (
    <>
      {bigHeader ? (
        <Header
          title={data.site.siteMetadata.title}
          description={data.site.siteMetadata.description}
          topics={data.site.siteMetadata.topics}
          menu={data.site.siteMetadata.menu}
          search={data.site.siteMetadata.search}
        />
      ) : (
        <Navigation
          title={data.site.siteMetadata.title}
          menu={data.site.siteMetadata.menu}
          showSearch={data.site.siteMetadata.search}
          dark={true}
        />
      )}
      <Main>
        {children}
      </Main>
      <Footer menu={data.site.siteMetadata.footerMenu} owner={data.site.siteMetadata.title}/>
    </>
  );
};

export default Layout;
