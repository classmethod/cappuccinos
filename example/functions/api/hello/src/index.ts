import * as utils from 'lib/utils';

export const handler = async (event: any): Promise <any> => {
    const name = event.name;
    return utils.sayHello(name);
};

