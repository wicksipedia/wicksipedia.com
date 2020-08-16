import React, {FunctionComponent} from "react";
import Layout from "../layout/layout";
import Subheader from "../layout/subheader";
import {Page} from "../utils/models";
import {Container} from "../components/common";
import styled from '@emotion/styled';
import PageSidebarContent from "../components/page-sidebar-content";
import SEO from "../components/seo";
import tw from "twin.macro";

interface PageTemplateProps {
  pathContext: {
    page: Page;
  };
  location: Location;
}

const PageContainer = styled(Container)`
  ${tw`flex flex-wrap`}
`;

const PageContent = styled.section([
  tw`prose p-2 w-full md:min-w-3/4`
]);

const Sidebar = styled.section`
  ${tw`p-2 w-full md:w-1/4 md:ml-auto`}
  > article {
    ${tw`py-2`}
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
      <Subheader title={page.frontmatter.title} />
      <PageContainer>
        <PageContent dangerouslySetInnerHTML={{__html: page.html}}/>
        <Sidebar>
          <PageSidebarContent />
        </Sidebar>
      </PageContainer>
    </Layout>
  );
};

export default PageTemplate;
