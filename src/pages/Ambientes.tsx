import AmbienteManagement from "@/components/AmbienteManagement";
import Layout from "@/components/Layout";

const Ambientes = () => {
  return (
    <Layout projectSelected={true}>
      <AmbienteManagement
        projectName="Sistema de Gestão Empresarial"
        projectSelected={true}
        initialAreas={[]}
        initialAmbientes={[]}
      />
    </Layout>
  );
};

export default Ambientes;
