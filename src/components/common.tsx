import styled from '@emotion/styled';
import tw from 'twin.macro';

export const Container = styled.div([
  tw`container mx-auto`
]);

export const Grid = styled(Container)<{ columns?: number }>`
  ${tw`grid gap-4 grid-flow-row`}
  grid-template-columns: repeat(${props => props.columns ? props.columns : 3}, 1fr);
`;
