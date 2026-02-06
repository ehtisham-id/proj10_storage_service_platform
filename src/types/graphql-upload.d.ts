declare module 'graphql-upload' {
  import { Readable } from 'stream';

  export interface FileUpload {
    filename: string;
    mimetype: string;
    encoding: string;
    createReadStream: () => Readable;
  }

  export const GraphQLUpload: any;
  export function graphqlUploadExpress(...args: any[]): any;
}
