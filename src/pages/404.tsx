import React, {FunctionComponent} from "react";
import Layout from "../layout/layout";
import {Link} from "gatsby";
import styled from '@emotion/styled';
import Theme from "../styles/theme";
import SEO from "../components/seo";

interface ErrorProps {
  location: Location;
}

const Error = styled.section`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-content: center;
  height: 75vh;
  text-align: center;
`;

const ErrorTitle = styled.h1`
  display: block;
  font-size: 8em;
  font-weight: bold;
  opacity: .45;
  width: 100%;
  margin: 0 0 15px;
`;

const ErrorDescription = styled.h2`
  font-size: 1.8em;
  display: block;
  width: 100%;
  margin-bottom: 15px;
`;

const NotFoundPage: FunctionComponent<ErrorProps> = ({location}) => (
  <Layout bigHeader={false}>
    <SEO
      location={location}
      title={`Page not found`}
    />
    <Error>
      <ErrorTitle>404</ErrorTitle>
      <ErrorDescription>Page not found</ErrorDescription>
      <Link to={`/`}>♫ Country roads...♫ Take me home!</Link>
    </Error>
  </Layout>
);

export default NotFoundPage;
