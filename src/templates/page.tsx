import React, {FunctionComponent} from "react";
import Layout from "../components/layout";
import Subheader from "../components/subheader";
import {Page} from "../utils/models";
import Theme from "../styles/theme";
import {Container} from "../components/common";
import styled from '@emotion/styled';
import PageSidebarContent from "../components/page-sidebar-content";
import SEO from "../components/seo";

interface PageTemplateProps {
  pathContext: {
    page: Page;
  };
  location: Location;
}

const PageContainer = styled(Container)`
  display: flex;
  justify-content: space-between;

  @media (max-width: ${Theme.breakpoints.md}) {
    display: block;
  }

  p:first-of-type {
    margin-top: 0;
  }
`;

const PageTemplate: FunctionComponent<PageTemplateProps> = ({pathContext, location}) => {
  const page = pathContext.page;

  return (
    <Layout bigHeader={false}>
      <SEO
        title={page.frontmatter.title}
        description={page.frontmatter.excerpt}
        location={location}
      />
      <Subheader title={page.frontmatter.title} backgroundColor={Theme.layout.primaryColor}/>
      <PageContainer>
        <section className="prose" dangerouslySetInnerHTML={{__html: page.html}}/>
        <aside className="ml-8 md:ml-0">
          <PageSidebarContent />
        </aside>
      </PageContainer>
    </Layout>
  );
};

export default PageTemplate;
