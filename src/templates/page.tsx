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
  `prose`,
  tw`max-w-none w-full p-2 md:w-7/12`
]);

const Sidebar = styled.section([
  tw`w-10/12 mx-auto pt-4 md:pt-0 md:w-4/12 md:ml-auto md:mr-0`
]);

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
