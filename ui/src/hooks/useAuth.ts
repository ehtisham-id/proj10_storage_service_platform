import { useMutation, useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { useEffect } from 'react';

const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      user {
        id
        email
        name
      }
    }
  }
`;

const ME = gql`
  query Me {
    me {
      id
      email
      name
    }
  }
`;

export const useAuth = () => {
  const [login] = useMutation(LOGIN);
  const { data: userData, refetch: refetchUser } = useQuery(ME, {
    skip: !localStorage.getItem('accessToken'),
  });

  const loginUser = async (email: string, password: string) => {
    const { data } = await login({ variables: { email, password } });
    if (data.login.accessToken) {
      localStorage.setItem('accessToken', data.login.accessToken);
      localStorage.setItem('refreshToken', data.login.refreshToken);
      await refetchUser();
    }
    return data.login;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.reload();
  };

  return {
    user: userData?.me,
    loginUser,
    logout,
    isAuthenticated: !!localStorage.getItem('accessToken'),
  };
};
